import Taro from '@tarojs/taro'
import { QUESTIONS_FUN } from '../data/questions-fun'
import { QUESTIONS_PRO } from '../data/questions-pro'
import { QuizSession, ReportItem, Version } from '../data/types'

const KEY_SESSION = (v: Version) => `ct_session_${v}`
const KEY_REPORTS = 'ct_reports'
const KEY_MOCK_PRO = 'ct_mock_pro_unlocked'
const SESSION_TTL = 7 * 24 * 3600 * 1000 // 7 天过期（M3）

const get = <T,>(key: string, fallback: T): T => {
  try {
    const v = Taro.getStorageSync(key)
    return (v === '' || v == null) ? fallback : v as T
  } catch {
    return fallback
  }
}

export const questionCount = (version: Version) =>
  version === 'pro' ? QUESTIONS_PRO.length : QUESTIONS_FUN.length

/* ---------------- 答题会话（本地为主，云端经 sessionSync 双写） ---------------- */

export function getSession(version: Version): QuizSession | null {
  const s = get<QuizSession | null>(KEY_SESSION(version), null)
  if (!s) return null
  if (Date.now() - (s.updatedAt || 0) > SESSION_TTL) {
    clearSession(version)
    return null
  }
  return s
}

export function newSession(version: Version): QuizSession {
  return {
    sessionId: `${version}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    version,
    answers: {},
    startedAt: Date.now(),
    updatedAt: Date.now()
  }
}

export function saveSession(session: QuizSession) {
  session.updatedAt = Date.now()
  try {
    Taro.setStorageSync(KEY_SESSION(session.version), session)
  } catch { /* ignore */ }
}

export function clearSession(version: Version) {
  try {
    Taro.removeStorageSync(KEY_SESSION(version))
  } catch { /* ignore */ }
}

export const answerCount = (session: QuizSession | null) =>
  session ? Object.keys(session.answers).length : 0

/** 第一个未作答的题目下标；全部答完返回最后一题 */
export function firstUnansweredIndex(session: QuizSession, version: Version) {
  const questions = version === 'pro' ? QUESTIONS_PRO : QUESTIONS_FUN
  const idx = questions.findIndex(q => !session.answers[q.id])
  return idx === -1 ? questions.length - 1 : idx
}

export const isSessionComplete = (session: QuizSession | null) => {
  if (!session) return false
  const questions = session.version === 'pro' ? QUESTIONS_PRO : QUESTIONS_FUN
  // 逐题校验而非键数统计：混入无效 qid 的脏数据不算完成（盲审修订）
  return questions.every(q => !!session.answers[q.id])
}

/* ---------------- 报告缓存（记录页离线兜底、报告页秒开） ---------------- */

export function getCachedReports(): ReportItem[] {
  return get<ReportItem[]>(KEY_REPORTS, [])
}

export function upsertCachedReport(report: ReportItem) {
  const list = getCachedReports().filter(r => r._id !== report._id)
  list.unshift(report)
  replaceCachedReports(list)
}

export function replaceCachedReports(list: ReportItem[]) {
  try {
    Taro.setStorageSync(KEY_REPORTS, list.slice(0, 50))
  } catch { /* ignore */ }
}

export function findCachedReport(id: string): ReportItem | null {
  return getCachedReports().find(r => r._id === id) || null
}

/* ---------------- Mock 专用：模拟 PRO 解锁状态 ---------------- */

export const getMockProUnlocked = () => get<boolean>(KEY_MOCK_PRO, false)

export const setMockProUnlocked = (v: boolean) => {
  try {
    Taro.setStorageSync(KEY_MOCK_PRO, v)
  } catch { /* ignore */ }
}

/* ---------------- 「清除我的数据」本地部分（D15） ---------------- */

export function clearAllLocal() {
  try {
    Taro.removeStorageSync(KEY_SESSION('fun'))
    Taro.removeStorageSync(KEY_SESSION('pro'))
    Taro.removeStorageSync(KEY_REPORTS)
    Taro.removeStorageSync(KEY_MOCK_PRO)
  } catch { /* ignore */ }
}
