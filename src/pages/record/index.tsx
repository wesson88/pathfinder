import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { ReportItem, QuizSession, Version } from '../../data/types'
import { callCloud } from '../../utils/cloud'
import {
  answerCount,
  clearSession,
  getCachedReports,
  getSession,
  questionCount,
  replaceCachedReports
} from '../../utils/storage'
import { track } from '../../utils/track'
import './index.scss'

const VERSION_LABEL: Record<Version, string> = { fun: '趣味版', pro: 'PRO' }

export default function Record() {
  const [reports, setReports] = useState<ReportItem[]>([])
  const [sessions, setSessions] = useState<QuizSession[]>([])

  useDidShow(() => {
    track('record_view')
    setReports(getCachedReports())

    // 未完成会话列表（含双会话规则的次要入口）；getSession 自带 TTL 清理
    const list = (['fun', 'pro'] as Version[])
      .map(v => ({ version: v, session: getSession(v) }))
      .filter((x): x is { version: Version; session: QuizSession } => !!x.session)
      .sort((a, b) => b.session.updatedAt - a.session.updatedAt)
    setSessions(list.map(x => x.session))

    // 云端刷新兜底（本地缓存优先展示，静默合并）
    callCloud<{ reports: ReportItem[] }>('getReports')
      .then(r => {
        if (!r.reports?.length) return
        const merged = [...getCachedReports(), ...r.reports].filter(
          (v, i, a) => a.findIndex(x => x._id === v._id) === i
        )
        replaceCachedReports(merged)
        setReports(getCachedReports())
      })
      .catch(() => { /* 离线可用 */ })
  })

  const openReport = (id: string) => Taro.navigateTo({ url: `/pages/report/index?id=${id}` })

  const continueSession = (s: QuizSession) => {
    track('record_view', { action: 'continue', version: s.version })
    Taro.navigateTo({ url: `/pages/quiz/index?version=${s.version}` })
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
                  已答 {answerCount(s)}/{questionCount(s.version)} 题 · 点击继续
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
                <view className='rec-item-meta'>{r.dateText || String(r.createdAt)}</view>
              </view>
              <view className='rec-item-arrow'>›</view>
            </view>
          ))}
        </view>
      )}
    </view>
  )
}
