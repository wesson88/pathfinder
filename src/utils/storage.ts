import Taro from '@tarojs/taro'
import { bankOf } from '../data/banks'
import { QuizSession, ReportItem, Version } from '../data/types'

const KEY_SESSION = (v: Version) => `ct_session_${v}`
const KEY_REPORTS = 'ct_reports'
const KEY_MOCK_PRO = 'ct_mock_pro_unlocked'
const KEY_CONSENT = 'ct_privacy_consent'
const SESSION_TTL = 7 * 24 * 3600 * 1000 // 7 天过期（M3）

const get = <T,>(key: string, fallback: T): T => {
  try {
    const v = Taro.getStorageSync(key)
    return (v === '' || v == null) ? fallback : v as T
  } catch {
    return fallback
  }
}

export const questionCount = (version: Version) => bankOf(version).length

/* ---------------- 答题会话（仅本机，D28） ---------------- */

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
  const questions = bankOf(version)
  const idx = questions.findIndex(q => !session.answers[q.id])
  return idx === -1 ? questions.length - 1 : idx
}

export const isSessionComplete = (session: QuizSession | null) => {
  if (!session) return false
  const questions = bankOf(session.version)
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

/** createdAt 统一转毫秒（云端存数值、mock 存 ISO 字符串） */
const createdAtMs = (r: ReportItem) =>
  typeof r.createdAt === 'number' ? r.createdAt : Date.parse(String(r.createdAt)) || 0

/**
 * 云端报告合并进本地缓存：去重 + 按创建时间倒序持久化
 * （报告页云端兜底 / 记录页刷新共用；盲审修复：原「本地在前」的拼接会让列表乱序）
 */
export function mergeCloudReports(cloudReports: ReportItem[]): ReportItem[] {
  const merged = [...getCachedReports(), ...(cloudReports || [])].filter(
    (v, i, a) => a.findIndex(x => x._id === v._id) === i
  )
  merged.sort((a, b) => createdAtMs(b) - createdAtMs(a))
  replaceCachedReports(merged)
  return merged
}

/* ---------------- Mock 专用：模拟 PRO 解锁状态 ---------------- */

export const getMockProUnlocked = () => get<boolean>(KEY_MOCK_PRO, false)

export const setMockProUnlocked = (v: boolean) => {
  try {
    Taro.setStorageSync(KEY_MOCK_PRO, v)
  } catch { /* ignore */ }
}

/* ---------------- 隐私告知同意（09 §5：同意前不采集行为数据） ---------------- */

export type ConsentState = 'granted' | 'declined' | null

/** 旧版本存的 true 视为 granted */
export const getConsent = (): ConsentState => {
  const v = get<string | boolean | null>(KEY_CONSENT, null)
  return v === true || v === 'granted' ? 'granted' : v === 'declined' ? 'declined' : null
}

/** 只有明确同意才采集使用分析（D33：可拒绝、可随时撤回） */
export const hasConsent = () => getConsent() === 'granted'

export const setConsent = (state: 'granted' | 'declined') => {
  try {
    Taro.setStorageSync(KEY_CONSENT, state)
  } catch { /* ignore */ }
}

/* ---------------- 「清除我的数据」本地部分（D15） ---------------- */

/** 清除答卷与报告缓存；隐私同意标记与（mock 的）已付费权益保留——与云端「paid 订单保留归属」一致 */
export function clearAllLocal() {
  try {
    Taro.removeStorageSync(KEY_SESSION('fun'))
    Taro.removeStorageSync(KEY_SESSION('pro'))
    Taro.removeStorageSync(KEY_REPORTS)
  } catch { /* ignore */ }
}
