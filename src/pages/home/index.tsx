import { useState } from 'react'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { HOME_COPY, SHARE_COPY, TESTIMONIALS } from '../../data/copy'
import { callCloud } from '../../utils/cloud'
import {
  answerCount,
  clearAllLocal,
  getSession,
  questionCount
} from '../../utils/storage'
import { track } from '../../utils/track'
import { QuizSession, Version } from '../../data/types'
import './index.scss'

export default function Home() {
  const [reportsTotal, setReportsTotal] = useState(0)
  const [resume, setResume] = useState<{ session: QuizSession; version: Version } | null>(null)

  useShareAppMessage(() => {
    track('report_share', { from: 'home' })
    return { title: SHARE_COPY.homeTitle, path: '/pages/home/index' }
  })

  useDidShow(() => {
    track('home_view')
    // 双会话规则：取 updatedAt 最新的未完成会话作为「继续」目标；次要入口在记录页
    const candidates = (['fun', 'pro'] as Version[])
      .map(v => ({ version: v, session: getSession(v) }))
      .filter((x): x is { version: Version; session: QuizSession } => !!x.session && !isDone(x.session))
    candidates.sort((a, b) => b.session.updatedAt - a.session.updatedAt)
    setResume(candidates[0] || null)

    callCloud<{ reportsTotal: number }>('getStats')
      .then(r => setReportsTotal(r.reportsTotal || 0))
      .catch(() => setReportsTotal(0))
  })

  const isDone = (s: QuizSession) => answerCount(s) >= questionCount(s.version)

  const onCta = () => {
    track('home_cta_click', { resume: !!resume, version: resume?.version })
    if (resume) {
      Taro.navigateTo({ url: `/pages/quiz/index?version=${resume.version}` })
    } else {
      Taro.navigateTo({ url: '/pages/version-select/index' })
    }
  }

  const onClearData = () => {
    Taro.showModal({
      title: '清除我的数据',
      content: '将删除本机与云端的答题记录、报告与行为数据（订单将匿名化保留），确定吗？',
      confirmText: '清除',
      confirmColor: '#6D28D9',
      success: (r) => {
        if (!r.confirm) return
        clearAllLocal()
        callCloud('deleteMyData').catch(() => { /* 云端失败不阻塞，本机已清 */ })
        Taro.showToast({ title: '已清除', icon: 'success' })
        track('data_delete')
        setResume(null)
      }
    })
  }

  const ctaText = resume
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
        {reportsTotal > 0 && (
          <view className='hero-stats'>已有 {reportsTotal} 人解锁了自己的天赋图谱</view>
        )}
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

      <view className='card testimonials'>
        <view className='section-title'>大家怎么说</view>
        {TESTIMONIALS.map(t => (
          <view key={t.who} className='t-item'>
            <view className='t-text'>「{t.text}」</view>
            <view className='t-who'>{t.who}</view>
          </view>
        ))}
      </view>

      <view className='home-footer'>
        <view className='disclaimer'>{HOME_COPY.disclaimer}</view>
        <view className='clear-link' onClick={onClearData}>清除我的数据</view>
      </view>
    </view>
  )
}
