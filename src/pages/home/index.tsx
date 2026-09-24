import { useState } from 'react'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import AgreementModal from '../../components/AgreementModal'
import FooterLinks from '../../components/FooterLinks'
import { CONSENT_COPY, HOME_COPY, SHARE_COPY, statsText } from '../../data/copy'
import { callCloud } from '../../utils/cloud'
import {
  answerCount,
  clearAllLocal,
  getSession,
  getConsent,
  isSessionComplete,
  questionCount,
  setConsent
} from '../../utils/storage'
import { track } from '../../utils/track'
import { QuizSession, Version } from '../../data/types'
import './index.scss'

export default function Home() {
  const [reportsTotal, setReportsTotal] = useState(0)
  const [resume, setResume] = useState<{ session: QuizSession; version: Version } | null>(null)
  const [consentDecided, setConsentDecided] = useState(getConsent() !== null)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  useShareAppMessage(() => {
    track('share_tap', { version: 'home' })
    return { title: SHARE_COPY.homeTitle, path: '/pages/home/index' }
  })

  useDidShow(() => {
    track('home_view')
    // 双会话规则：取 updatedAt 最新的本机会话作为主按钮目标（含已答完未交卷）；次要入口在记录页
    const candidates = (['fun', 'pro'] as Version[])
      .map(v => ({ version: v, session: getSession(v) }))
      .filter((x): x is { version: Version; session: QuizSession } => !!x.session)
    candidates.sort((a, b) => b.session.updatedAt - a.session.updatedAt)
    setResume(candidates[0] || null)

    callCloud<{ reportsTotal: number }>('getStats')
      .then(r => setReportsTotal(r.reportsTotal || 0))
      .catch(() => setReportsTotal(0))
  })

  const onConsent = (state: 'granted' | 'declined') => {
    setConsent(state)
    setConsentDecided(true)
    if (state === 'granted') track('home_view')
  }

  const onCta = () => {
    const complete = !!resume && isSessionComplete(resume.session)
    track('home_cta_tap', { mode: complete ? 'submit' : resume ? 'resume' : 'start' })
    if (resume) {
      Taro.navigateTo({ url: `/pages/quiz/index?version=${resume.version}${complete ? '&autoSubmit=1' : ''}` })
    } else {
      Taro.navigateTo({ url: '/pages/version-select/index' })
    }
  }

  /** 以云端结果为准提示成败（二轮盲审 X6：原先提示「已清除」再调云端，失败静默） */
  const onClearData = () => {
    if (clearing) return
    Taro.showModal({
      title: '清除我的数据',
      content: '将永久删除你在本机与云端的答卷、全部报告（含已付费生成的 PRO 报告）、反馈与行为数据，无法恢复；未交卷的作答也会清除。已付费但尚未使用的 PRO 会保留。确定吗？',
      confirmText: '清除',
      confirmColor: '#6D28D9',
      success: (r) => {
        if (!r.confirm) return
        setClearing(true)
        Taro.showLoading({ title: '正在清除' })
        callCloud('deleteMyData')
          .then(() => {
            track('data_clear', { ok: true })
            clearAllLocal()
            setResume(null)
            Taro.hideLoading()
            Taro.showToast({ title: '已清除', icon: 'success' })
          })
          .catch(() => {
            track('data_clear', { ok: false })
            Taro.hideLoading()
            Taro.showModal({
              title: '部分数据未清除',
              content: '网络或服务异常，请稍后再试一次；也可以联系客服处理。',
              showCancel: false
            })
          })
          .finally(() => setClearing(false))
      }
    })
  }

  const ctaText = resume && isSessionComplete(resume.session)
    ? HOME_COPY.ctaSubmit
    : resume
    ? HOME_COPY.ctaResume(Math.min(answerCount(resume.session) + 1, questionCount(resume.version)), questionCount(resume.version))
    : HOME_COPY.cta

  return (
    <view className='home'>
      <view className='hero'>
        <view className='hero-title'>
          {HOME_COPY.title.map(line => (
            <view key={line} className='hero-line'>{line}</view>
          ))}
        </view>
        <view className='hero-sub'>{HOME_COPY.sub}</view>
        {reportsTotal > 0 && <view className='hero-stats'>{statsText(reportsTotal)}</view>}
      </view>

      <view className='btn-primary home-cta' onClick={onCta}>{ctaText}</view>
      <view className='home-meta'>{HOME_COPY.meta}</view>

      <view className='card why'>
        <view className='section-title'>{HOME_COPY.whyTitle}</view>
        {HOME_COPY.why.map(w => (
          <view key={w.name} className='why-item'>
            <view className='why-name'>{w.name}</view>
            <view className='why-desc'>{w.desc}</view>
          </view>
        ))}
      </view>

      <view className='home-footer'>
        <view className='disclaimer'>{HOME_COPY.disclaimer}</view>
        <FooterLinks source='home' />
        <view className='clear-link' onClick={onClearData}>清除我的数据</view>
      </view>

      {!consentDecided && (
        <view className='consent-mask'>
          <view className='consent-panel'>
            <view className='consent-title'>{CONSENT_COPY.title}</view>
            <view className='consent-body'>
              {CONSENT_COPY.body}
              <text className='consent-link' onClick={() => setPrivacyOpen(true)}>《隐私政策》</text>
            </view>
            <view className='btn-primary consent-btn' onClick={() => onConsent('granted')}>{CONSENT_COPY.agree}</view>
            <view className='consent-decline' onClick={() => onConsent('declined')}>{CONSENT_COPY.decline}</view>
          </view>
        </view>
      )}
      <AgreementModal agreementKey={privacyOpen ? 'privacy' : null} onClose={() => setPrivacyOpen(false)} />
    </view>
  )
}
