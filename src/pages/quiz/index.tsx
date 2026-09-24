import { useEffect, useRef, useState } from 'react'
import Taro, { useDidHide, useRouter, useUnload } from '@tarojs/taro'
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
  const submittedRef = useRef(false)
  const sessionRef = useRef<QuizSession | null>(null)
  const indexRef = useRef(0)
  sessionRef.current = session
  indexRef.current = index

  // 流失定位（10 §3）：离开答题页且未交卷 → quiz_abandon（停在第几题、已答几题）
  const abandonedAtRef = useRef(-1)
  const reportAbandon = () => {
    const s = sessionRef.current
    if (!s || submittedRef.current) return
    // 切后台后又卸载会连触两次：同一进度只记一次
    const answered = Object.keys(s.answers).length
    if (abandonedAtRef.current === answered) return
    abandonedAtRef.current = answered
    track('quiz_abandon', {
      version,
      qid: questions[indexRef.current]?.id,
      answeredCount: Object.keys(s.answers).length
    })
  }
  useDidHide(reportAbandon)
  useUnload(reportAbandon)

  // 初始化会话：进度恢复 / 新建（useEffect 保证副作用只在挂载后发生）
  useEffect(() => {
    if (initedRef.current) return
    initedRef.current = true
    const s0 = getSession(version)
    if (s0) {
      track('quiz_start', { version, isResume: true })
      setSession(s0)
      setIndex(firstUnansweredIndex(s0, version))
      qStartRef.current = Date.now()
      // 已答完未交卷（上次交卷失败/杀进程）：从首页「生成上次测试报告」进入时自动重交（03 §4，幂等）
      if (router.params.autoSubmit === '1' && isSessionComplete(s0)) submit(s0)
      return
    }
    // mock 模式下 PRO 需先解锁（真实模式由入口页 checkOrder / 支付页保障）
    if (version === 'pro' && isMockMode() && !getMockProUnlocked()) {
      Taro.redirectTo({ url: '/pages/pay-confirm/index' })
      return
    }
    const fresh = newSession(version)
    saveSession(fresh)
    track('quiz_start', { version, isResume: false })
    setSession(fresh)
    setIndex(0)
    qStartRef.current = Date.now()
  }, [])

  // 进度仅存本机（D28：云端双写下线）
  const persist = (s: QuizSession) => saveSession(s)

  const restart = () => {
    Taro.showModal({
      title: '重新开始？',
      content: version === 'pro'
        ? '当前作答进度将被清空（已支付的 PRO 不受影响，重新作答不再收费），确定重新开始吗？'
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
          submittedRef.current = true
          track('quiz_submit', { version, ok: true })
          Taro.redirectTo({ url: `/pages/report/index?id=${r.reportId}` })
        })
        .catch((e: Error) => {
          setSubmitting(false)
          if (e && e.message === 'NO_PAID_ORDER') {
            // 订单异常（他端已核销/未支付）：引导重新解锁
            Taro.showModal({
              title: '需要付费生成 PRO 报告',
              content: '没有找到可用的已支付订单（每次付费生成 1 份 PRO 报告），请先完成支付；你的作答进度会保留',
              showCancel: false,
              success: () => Taro.redirectTo({ url: '/pages/pay-confirm/index' })
            })
            return
          }
          setSubmitError(true)
          track('quiz_submit', { version, ok: false, error: e?.message })
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
    track('quiz_answer', { version, qid: q.id, key: optKey, ms: answer.ms })

    // 答完最后一题不自动交卷：停在最后一题显示「提交并生成报告」，可回看修改（03 §4）
    if (index < questions.length - 1) {
      setIndex(index + 1)
      qStartRef.current = Date.now()
    }
  }

  /** 趣味版云端不可用时本机出报告（03 §5 降级；PRO 绝不本地伪造） */
  const submitLocal = (s: QuizSession) => {
    try {
      const result = computeResult(version, s.answers)
      const id = `local-${s.sessionId}`
      upsertCachedReport({
        _id: id,
        version,
        result,
        sessionId: s.sessionId,
        answers: s.answers,
        createdAt: Date.now(),
        dateText: formatDateTime(Date.now())
      })
      submittedRef.current = true
      clearSession(version)
      Taro.redirectTo({ url: `/pages/report/index?id=${id}` })
    } catch {
      Taro.showToast({ title: '生成失败，请重试', icon: 'none' })
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
        {index < questions.length - 1 && session.answers[q.id] && (
          <view className='quiz-prev' onClick={() => setIndex(index + 1)}>下一题</view>
        )}
      </view>

      {isSessionComplete(session) && (
        <view className='btn-primary quiz-submit' onClick={() => submit(session)}>提交并生成报告</view>
      )}

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
              {version === 'fun' && (
                <view className='quiz-local' onClick={() => submitLocal(session)}>先在本机生成报告（仅本机可见）</view>
              )}
            </view>
          )}
        </view>
      )}
    </view>
  )
}
