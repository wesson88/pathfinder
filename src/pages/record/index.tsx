import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { ReportItem, QuizSession, Version } from '../../data/types'
import { callCloud } from '../../utils/cloud'
import { formatDateTime } from '../../utils/format'
import {
  answerCount,
  clearSession,
  getCachedReports,
  getSession,
  isSessionComplete,
  mergeCloudReports,
  questionCount
} from '../../utils/storage'
import './index.scss'

const VERSION_LABEL: Record<Version, string> = { fun: '趣味版', pro: 'PRO' }

export default function Record() {
  const [reports, setReports] = useState<ReportItem[]>([])
  // 云端分页（三轮盲审 N10：换设备后不止能取回最近 20 份）
  const [cloudSkip, setCloudSkip] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sessions, setSessions] = useState<QuizSession[]>([])

  useDidShow(() => {
    setReports(getCachedReports())

    // 未完成会话列表（含双会话规则的次要入口）；getSession 自带 TTL 清理
    const list = (['fun', 'pro'] as Version[])
      .map(v => ({ version: v, session: getSession(v) }))
      .filter((x): x is { version: Version; session: QuizSession } => !!x.session)
      .sort((a, b) => b.session.updatedAt - a.session.updatedAt)
    setSessions(list.map(x => x.session))

    // 云端刷新兜底（本地缓存优先展示，静默合并）
    callCloud<{ reports: ReportItem[]; hasMore?: boolean }>('getReports')
      .then(r => {
        if (r.reports?.length) setReports(mergeCloudReports(r.reports))
        setCloudSkip(r.reports?.length || 0)
        setHasMore(!!r.hasMore)
      })
      .catch(() => { /* 离线可用 */ })
  })

  const loadMore = () => {
    if (loadingMore) return
    setLoadingMore(true)
    callCloud<{ reports: ReportItem[]; hasMore?: boolean }>('getReports', { skip: cloudSkip })
      .then(r => {
        const more = r.reports || []
        // 超出本地缓存上限的旧报告只在本页展示，不写缓存
        setReports(list => [...list, ...more.filter(x => !list.some(y => y._id === x._id))])
        setCloudSkip(cloudSkip + more.length)
        setHasMore(!!r.hasMore)
      })
      .catch(() => Taro.showToast({ title: '加载失败，请重试', icon: 'none' }))
      .finally(() => setLoadingMore(false))
  }

  const openReport = (id: string) => Taro.navigateTo({ url: `/pages/report/index?id=${id}` })

  const continueSession = (s: QuizSession) => {
    Taro.navigateTo({ url: `/pages/quiz/index?version=${s.version}${isSessionComplete(s) ? '&autoSubmit=1' : ''}` })
  }

  const removeSession = (s: QuizSession) => {
    Taro.showModal({
      title: '删除作答进度',
      content: `删除这份未完成的${VERSION_LABEL[s.version]}作答？`,
      success: (r) => {
        if (!r.confirm) return
        clearSession(s.version)
        setSessions(list => list.filter(x => x.sessionId !== s.sessionId))
      }
    })
  }

  return (
    <view className='record'>
      {sessions.length > 0 && (
        <view className='card rec-sessions'>
          <view className='rec-title'>未完成的测试</view>
          {sessions.map(s => (
            <view key={s.sessionId} className='rec-session'>
              <view className='rec-session-main' onClick={() => continueSession(s)}>
                <view className='rec-session-name'>
                  {VERSION_LABEL[s.version]}
                  {s.version === 'pro' && <view className='pro-badge'>PRO</view>}
                </view>
                <view className='rec-session-meta'>
                  {isSessionComplete(s)
                    ? '已答完 · 点击生成报告'
                    : `已答 ${answerCount(s)}/${questionCount(s.version)} 题 · 点击继续`}
                </view>
              </view>
              <view className='rec-session-del' onClick={() => removeSession(s)}>删除</view>
            </view>
          ))}
        </view>
      )}

      {reports.length === 0 && sessions.length === 0 && (
        <view className='rec-empty'>
          <view className='rec-empty-emoji'>🌱</view>
          <view className='rec-empty-text'>还没有记录，去「发现」测一份你的天赋报告吧</view>
        </view>
      )}

      {reports.length > 0 && (
        <view className='card rec-list'>
          <view className='rec-title'>我的报告</view>
          {reports.map(r => (
            <view key={r._id} className='rec-item' onClick={() => openReport(r._id)}>
              <view className='rec-item-main'>
                <view className='rec-item-name'>
                  {r.result.archetypeName}
                  {r.result.version === 'pro' && <view className='pro-badge'>PRO</view>}
                </view>
                <view className='rec-item-meta'>
                  {r.dateText || formatDateTime(r.createdAt)}
                  {r._id.startsWith('local-') ? ' · 仅保存在本机' : ''}
                </view>
              </view>
              <view className='rec-item-arrow'>›</view>
            </view>
          ))}
          {hasMore && (
            <view className='rec-more' onClick={loadMore}>{loadingMore ? '加载中…' : '加载更早的报告'}</view>
          )}
        </view>
      )}
    </view>
  )
}
