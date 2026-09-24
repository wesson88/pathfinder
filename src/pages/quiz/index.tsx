import { useEffect, useRef, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { bankOf } from '../../data/banks'
import { AnswerValue, QuizSession, Version } from '../../data/types'
import { callCloud, isMockMode } from '../../utils/cloud'
import { formatDateTime } from '../../utils/format'
import { computeResult } from '../../utils/scoring'
import {
  clearSession,
  firstUnansweredIndex,
  getMockProUnlocked,
  getSession,
  isSessionComplete,
  newSession,
  saveSession,
  upsertCachedReport
} from '../../utils/storage'
import { track } from '../../utils/track'
import './index.scss'

/** 云端进度同步最小间隔：答题期间至多每 5s 一次，尾随补发最新一帧 */
const SYNC_MIN_INTERVAL = 5000

export default function Quiz() {
  const router = useRouter()
  const version = (router.params.version === 'pro' ? 'pro' : 'fun') as Version
  const questions = bankOf(version)

  const [session, setSession] = useState<QuizSession | null>(null)
  const [index, setIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const qStartRef = useRef(Date.now())
  const initedRef = useRef(false)
  const lastSyncRef = useRef(0)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef<QuizSession | null>(null)

  // 初始化会话：进度恢复 / 新建（useEffect 保证副作用只在挂载后发生）
  useEffect(() => {
    if (initedRef.current) return
    initedRef.current = true
    const s0 = getSession(version)
    if (s0) {
      track('quiz_start', { version, resume: true })
      setSession(s0)
      setIndex(firstUnansweredIndex(s0, version))
      qStartRef.current = Date.now()
      return
    }
    // mock 模式下 PRO 需先解锁（真实模式由入口页 checkOrder / 支付页保障）
    if (version === 'pro' && isMockMode() && !getMockProUnlocked()) {
      Taro.redirectTo({ url: '/pages/pay-confirm/index' })
      return
    }
    const fresh = newSession(version)
    saveSession(fresh)
    track('quiz_start', { version, fresh: true })
    setSession(fresh)
    setIndex(0)
    qStartRef.current = Date.now()
  }, [])

  const doSync = () => {
    const s = latestRef.current
    if (!s) return
    latestRef.current = null
    lastSyncRef.current = Date.now()
    // 云端进度双写（M3）：fire-and-forget，失败不影响答题
    callCloud('sessionSync', { session: s }).catch(() => { /* ignore */ })
  }

  const persist = (s: QuizSession) => {
    saveSession(s)
    // 节流双写（盲审修复：原每题一次云写）：≥SYNC_MIN_INTERVAL 一次，待发期间只更新最新帧
    latestRef.current = s
    if (syncTimerRef.current) return
    const wait = SYNC_MIN_INTERVAL - (Date.now() - lastSyncRef.current)
    if (wait <= 0) {
      doSync()
      return
    }
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null
      doSync()
    }, wait)
  }

  const restart = () => {
    Taro.showModal({
      title: '重新开始？',
      content: version === 'pro'
        ? '当前作答进度将被清空（不影响已支付的解锁权益），确定重新开始吗？'
        : '当前作答进度将被清空，确定重新开始吗？',
      success: (r) => {
        if (!r.confirm) return
        clearSession(version)
        const s = newSession(version)
        saveSession(s)
        setSession(s)
        setIndex(0)
        qStartRef.current = Date.now()
      }
    })
  }

  const submit = (s: QuizSession) => {
    if (submitting) return
    if (!isSessionComplete(s)) {
      Taro.showToast({ title: '还有题目未作答', icon: 'none' })
      return
    }
    setSubmitting(true)
    setSubmitError(false)

    try {
      const result = computeResult(version, s.answers)
      callCloud<{ reportId: string }>('submitTest', {
        sessionId: s.sessionId,
        version,
        result,
        answers: s.answers
      })
        .then(r => {
          const report = {
            _id: r.reportId,
            version,
            result,
            sessionId: s.sessionId,
            answers: s.answers,
            createdAt: Date.now(),
            dateText: formatDateTime(Date.now())
          }
          upsertCachedReport(report)
          clearSession(version)
          track('quiz_submit', { version, sessionId: s.sessionId })
          Taro.redirectTo({ url: `/pages/report/index?id=${r.reportId}` })
        })
        .catch((e: Error) => {
          setSubmitting(false)
          if (e && e.message === 'NO_PAID_ORDER') {
            // 订单异常（他端已核销/未支付）：引导重新解锁
            Taro.showModal({
              title: '需要解锁 PRO',
              content: '未找到可用的已支付订单，请先完成解锁',
              showCancel: false,
              success: () => Taro.redirectTo({ url: '/pages/pay-confirm/index' })
            })
            return
          }
          setSubmitError(true)
          track('quiz_submit_fail', { version })
        })
    } catch {
      setSubmitting(false)
      setSubmitError(true)
    }
  }

  const onSelect = (optKey: string) => {
    if (!session || submitting) return
    const q = questions[index]
    const answer: AnswerValue = { key: optKey, ms: Date.now() - qStartRef.current }
    const updated: QuizSession = {
      ...session,
      answers: { ...session.answers, [q.id]: answer }
    }
    setSession(updated)
    persist(updated)

    if (isSessionComplete(updated)) {
      submit(updated)
    } else {
      setIndex(index + 1)
      qStartRef.current = Date.now()
    }
  }

  if (!session) return null

  const q = questions[index]
  const selectedKey = session.answers[q.id]?.key
  const answeredCount = Object.keys(session.answers).length
  const isForced = q.type === 'forced'

  return (
    <view className='quiz'>
      <view className='quiz-top'>
        <view className='quiz-progress'>
          <view className='quiz-progress-inner' style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </view>
        <view className='quiz-count'>{index + 1} / {questions.length}</view>
        <view className='quiz-restart' onClick={restart}>重开</view>
      </view>

      {q.category && <view className='quiz-category'>{q.category}</view>}
      <view className='quiz-question'>{q.question}</view>
      {q.hint && <view className='quiz-hint'>{q.hint}</view>}

      <view className={isForced ? 'options forced' : 'options'}>
        {q.options.map(opt => (
          <view
            key={opt.key}
            className={`option ${selectedKey === opt.key ? 'selected' : ''}`}
            onClick={() => onSelect(opt.key)}
          >
            <view className='option-key'>{opt.key}</view>
            <view className='option-text'>{opt.text}</view>
          </view>
        ))}
      </view>

      <view className='quiz-nav'>
        {index > 0 && (
          <view className='quiz-prev' onClick={() => setIndex(index - 1)}>上一题</view>
        )}
      </view>

      {(submitting || submitError) && (
        <view className='quiz-mask'>
          {submitting && !submitError && (
            <view className='quiz-loading'>
              <view className='quiz-loading-dot' />
              <view>正在生成你的报告…</view>
            </view>
          )}
          {submitError && (
            // 盲审修复：原按钮只在 submitting 内渲染，而错误路径必先复位 submitting，永不出现
            <view className='quiz-loading quiz-loading-col'>
              <view>提交失败，请重试</view>
              <view className='btn-primary quiz-retry' onClick={() => submit(session)}>重新提交</view>
            </view>
          )}
        </view>
      )}
    </view>
  )
}
