import { useEffect, useRef, useState } from 'react'
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro'
import RadarChart from '../../components/RadarChart'
import { isIosPayHidden } from '../../config'
import {
  archetypeTier,
  careerTier,
  DIM_EXPLAIN,
  DIM_LEVEL,
  levelOf,
  LEVEL_LABEL,
  MATCH_FOOTNOTE,
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
  const trackedRef = useRef(false)

  useShareAppMessage(() => {
    track('report_share', { reportId: id })
    const r = report?.result
    const title = r
      ? `我的${r.version === 'pro' ? '天赋原型' : '趣味天赋'}是「${r.archetypeName}」，来测测你的？`
      : '天赋星球｜找到让你闪闪发光的职业'
    return { title, path: '/pages/home/index' }
  })

  useEffect(() => {
    if (report && !trackedRef.current) {
      trackedRef.current = true
      track('report_view', { version: report.result.version, reportId: id })
    }
  }, [!!report])

  // 本地缓存未命中 → 云端兜底（报告页秒开策略，M6）
  useEffect(() => {
    if (loaded) return
    callCloud<{ reports: ReportItem[] }>('getReports')
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
  // iOS hidden 铁律同样适用于报告页的 PRO 转化卡：整卡不展示
  const upsellVisible = !isPro && !isIosPayHidden()

  return (
    <view className='report'>
      <view className='rep-head'>
        {isPro && <view className='pro-badge'>PRO</view>}
        <view className='rep-name'>{r.archetypeName}</view>
        <view className='rep-slogan'>{r.slogan}</view>
        {isPro && r.archetypeMatch != null && (
          <view className='rep-tier'>原型匹配：{archetypeTier(r.archetypeMatch)}</view>
        )}
        <view className='rep-date'>{report.dateText || formatDateTime(report.createdAt)}</view>
      </view>

      <view className='card rep-radar'>
        <RadarChart scores={r.scores} labels={r.radarLabels || DIM_ORDER.map(d => DIM_META[d].label)} onTapDim={setExplainDim} />
        <view className='rep-radar-tip'>点按雷达图维度，看这条天赋的解释</view>
      </view>

      <view className='card rep-insight'>
        <view className='section-title'>核心洞察</view>
        <view className='rep-insight-text'>{r.coreInsight}</view>
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
              <view className='dim-score'>{score}</view>
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
              <view className='career-tier'>{careerTier(c.percent)}</view>
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

      {upsellVisible && (
        <view className='card rep-upsell' onClick={() => Taro.navigateTo({ url: '/pages/pay-confirm/index' })}>
          <view className='upsell-title'>{UPSELL_COPY.title}</view>
          <view className='upsell-desc'>{upsellDesc(r.careerFitHint || 0)}</view>
          <view className='btn-primary upsell-btn'>{UPSELL_COPY.cta}</view>
        </view>
      )}

      <view className='disclaimer rep-disclaimer'>{REPORT_DISCLAIMER}</view>

      {explainDim && (
        <view className='explain-mask' onClick={() => setExplainDim(null)}>
          <view className='explain-panel' onClick={(e) => e.stopPropagation()}>
            <view className='explain-name'>
              {DIM_META[explainDim].label}
              <text className='explain-score'>
                {r.scores[explainDim]} · {LEVEL_LABEL[levelOf(r.scores[explainDim])]}
              </text>
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
