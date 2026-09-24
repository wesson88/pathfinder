import { useEffect, useRef, useState } from 'react'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import { Button, Textarea } from '@tarojs/components'
import FooterLinks from '../../components/FooterLinks'
import RadarChart from '../../components/RadarChart'
import {
  DIM_EXPLAIN,
  DIM_LEVEL,
  FEEDBACK_COPY,
  legacyArchetypeTier,
  legacyCareerTier,
  levelOf,
  LEVEL_LABEL,
  MATCH_FOOTNOTE,
  QC_NOTICE,
  RADAR_NOTE,
  SHARE_COPY,
  UPSELL_COPY,
  upsellDesc
} from '../../data/copy'
import { REPORT_DISCLAIMER } from '../../data/agreements'
import { ReportItem } from '../../data/types'
import { DIM_META, DIM_ORDER } from '../../data/archetypes'
import { callCloud } from '../../utils/cloud'
import { formatDateTime } from '../../utils/format'
import { findCachedReport, mergeCloudReports } from '../../utils/storage'
import { track } from '../../utils/track'
import { DimKey } from '../../data/types'
import './index.scss'

export default function Report() {
  const router = useRouter()
  const id = router.params.id || ''
  const [report, setReport] = useState<ReportItem | null>(() => findCachedReport(id))
  const [loaded, setLoaded] = useState(!!report)
  const [explainDim, setExplainDim] = useState<DimKey | null>(null)
  const [accuracy, setAccuracy] = useState<'good' | 'bad' | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [sending, setSending] = useState(false)
  const trackedRef = useRef(false)

  // 分享标题不带任何百分比，落地一律回首页（08 §2）
  useShareAppMessage(() => {
    track('share_tap', { version: report?.result.version })
    const r = report?.result
    const title = r
      ? r.version === 'pro' ? SHARE_COPY.pro(r.archetypeName) : SHARE_COPY.fun(r.archetypeName)
      : SHARE_COPY.homeTitle
    return { title, path: '/pages/home/index', imageUrl: '/assets/share-card.png' }
  })

  const sendFeedback = () => {
    if (!accuracy || sending || feedbackSent) return
    setSending(true)
    callCloud('submitFeedback', { reportId: id, accuracy, content: feedbackText.trim() })
      .then(() => {
        setFeedbackSent(true)
        track('report_feedback', { accuracy, hasText: !!feedbackText.trim() })
        Taro.showToast({ title: '已收到', icon: 'success' })
      })
      .catch((e: Error) => {
        const risky = e && (e.message === 'CONTENT_RISKY' || e.message === 'CONTENT_CHECK_FAILED')
        Taro.showToast({ title: risky ? '文字未通过检测，请修改后再提交' : '提交失败，请重试', icon: 'none' })
      })
      .finally(() => setSending(false))
  }

  const retake = () => {
    track('retake_tap', { version: report?.result.version })
    Taro.navigateTo({ url: '/pages/version-select/index' })
  }

  useEffect(() => {
    if (report && !trackedRef.current) {
      trackedRef.current = true
      track('report_view', { version: report.result.version, reportId: id })
    }
  }, [!!report])

  // 本地缓存未命中 → 云端兜底（报告页秒开策略，M6）
  useEffect(() => {
    if (loaded) return
    // 按 id 精确取，不受列表条数限制
    callCloud<{ reports: ReportItem[] }>('getReports', { id })
      .then(r => {
        mergeCloudReports(r.reports || [])
        const hit = findCachedReport(id)
        setReport(hit)
        if (!hit) {
          // home 是 tabBar 页，redirectTo 不允许跳转（盲审修复），须用 switchTab
          Taro.showToast({ title: '报告不存在或已过期', icon: 'none' })
          Taro.switchTab({ url: '/pages/home/index' })
        }
      })
      .catch(() => {
        Taro.showToast({ title: '报告加载失败', icon: 'none' })
        Taro.switchTab({ url: '/pages/home/index' })
      })
      .finally(() => setLoaded(true))
  }, [loaded])

  if (!report) return null
  const r = report.result
  const isPro = r.version === 'pro'
  // 全终端虚拟支付（D25）：转化卡各平台一致展示
  const upsellVisible = !isPro
  // v2 结果自带档位；v1 旧报告按旧百分比换算（不迁移，M7 版本化）
  const archetypeTierText =
    r.archetypeTier || (r.archetypeMatch != null ? legacyArchetypeTier(r.archetypeMatch) : '')

  return (
    <view className='report'>
      <view className='rep-head'>
        {isPro && <view className='pro-badge'>PRO</view>}
        <view className='rep-name'>{r.archetypeName}</view>
        <view className='rep-slogan'>{r.slogan}</view>
        {isPro && archetypeTierText && <view className='rep-tier'>原型匹配：{archetypeTierText}</view>}
        <view className='rep-date'>{report.dateText || formatDateTime(report.createdAt)}</view>
      </view>

      <view className='card rep-radar'>
        <RadarChart scores={r.scores} labels={r.radarLabels || DIM_ORDER.map(d => DIM_META[d].label)} onTapDim={setExplainDim} />
        <view className='rep-radar-tip'>点按雷达图维度，看这条天赋的解释</view>
        <view className='rep-footnote'>{RADAR_NOTE}</view>
      </view>

      <view className='card rep-insight'>
        <view className='section-title'>核心洞察</view>
        <view className='rep-insight-text'>{r.coreInsight}</view>
        {r.mirror && r.mirror.map(line => (
          <view key={line} className='rep-mirror'>{line}</view>
        ))}
      </view>

      <view className='card rep-dims'>
        <view className='section-title'>你的五维画像</view>
        {DIM_ORDER.map(dim => {
          const score = r.scores[dim]
          const level = levelOf(score)
          return (
            <view key={dim} className='dim-row' onClick={() => setExplainDim(dim)}>
              <view className='dim-label'>{DIM_META[dim].label}</view>
              <view className='dim-bar'>
                <view className='dim-bar-inner' style={{ width: `${score}%` }} />
              </view>
              <view className={`dim-level lv-${level}`}>{LEVEL_LABEL[level]}</view>
            </view>
          )
        })}
      </view>

      {isPro && r.careers && r.careers.length > 0 && (
        <view className='card rep-careers'>
          <view className='section-title'>职业方向参考</view>
          {r.careers.map((c, i) => (
            <view key={c.name} className='career-item'>
              <view className='career-rank'>TOP{i + 1}</view>
              <view className='career-main'>
                <view className='career-name'>{c.name}</view>
                <view className='career-reason'>{c.reason}</view>
              </view>
              <view className='career-tier'>{c.tier || (c.percent != null ? legacyCareerTier(c.percent) : '')}</view>
            </view>
          ))}
          <view className='rep-footnote'>{MATCH_FOOTNOTE}</view>
        </view>
      )}

      {isPro && r.advice && (
        <view className='card rep-advice'>
          <view className='section-title'>成长行动建议</view>
          <view className='advice-item'>
            <view className='advice-label'>放大优势</view>
            <view className='advice-text'>{r.advice.amplify}</view>
          </view>
          <view className='advice-item'>
            <view className='advice-label'>留意盲区</view>
            <view className='advice-text'>{r.advice.blindSpot}</view>
          </view>
        </view>
      )}

      {r.qc && (r.qc.fastRatio > 0.5 || r.qc.sameKeyRatio > 0.9) && (
        <view className='card rep-qc'>{QC_NOTICE}</view>
      )}

      {upsellVisible && (
        <view className='card rep-upsell' onClick={() => Taro.navigateTo({ url: '/pages/pay-confirm/index' })}>
          <view className='upsell-title'>{UPSELL_COPY.title}</view>
          <view className='upsell-desc'>{upsellDesc(r.careerFitHint || 0)}</view>
          <view className='btn-primary upsell-btn'>{UPSELL_COPY.cta}</view>
        </view>
      )}

      {!id.startsWith('local-') && (
        <view className='card rep-feedback'>
          <view className='section-title'>{FEEDBACK_COPY.title}</view>
          {feedbackSent ? (
            <view className='fb-thanks'>{FEEDBACK_COPY.thanks}</view>
          ) : (
            <view>
              <view className='fb-choices'>
                {(['good', 'bad'] as const).map(a => (
                  <view key={a} className={`fb-choice ${accuracy === a ? 'on' : ''}`} onClick={() => setAccuracy(a)}>
                    {FEEDBACK_COPY[a]}
                  </view>
                ))}
              </view>
              {accuracy && (
                <view>
                  <Textarea
                    className='fb-input'
                    maxlength={200}
                    value={feedbackText}
                    placeholder={FEEDBACK_COPY.placeholder}
                    onInput={e => setFeedbackText(e.detail.value)}
                  />
                  <view className={`btn-primary fb-submit ${sending ? 'disabled' : ''}`} onClick={sendFeedback}>
                    {FEEDBACK_COPY.submit}
                  </view>
                </view>
              )}
            </view>
          )}
        </view>
      )}

      <view className='rep-actions'>
        <view className='btn-ghost rep-action' onClick={retake}>再测一次</view>
        <Button className='btn-primary rep-action rep-share' openType='share'>分享结果</Button>
      </view>

      <view className='disclaimer rep-disclaimer'>{REPORT_DISCLAIMER}</view>
      <FooterLinks source='report' />

      {explainDim && (
        <view className='explain-mask' onClick={() => setExplainDim(null)}>
          <view className='explain-panel' onClick={(e) => e.stopPropagation()}>
            <view className='explain-name'>
              {DIM_META[explainDim].label}
              <text className='explain-score'>{LEVEL_LABEL[levelOf(r.scores[explainDim])]}</text>
            </view>
            <view className='explain-text'>{DIM_EXPLAIN[explainDim]}</view>
            <view className='explain-behavior'>{DIM_LEVEL[explainDim][levelOf(r.scores[explainDim])]}</view>
            <view className='btn-primary explain-close' onClick={() => setExplainDim(null)}>知道了</view>
          </view>
        </view>
      )}
    </view>
  )
}
