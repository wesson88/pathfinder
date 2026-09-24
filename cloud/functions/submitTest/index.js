const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const EXPECTED = { fun: 6, pro: 12 }
const MAX_RETRY = 3 // 事务冲突重试上限（03 §5）
const DAY = 24 * 3600 * 1000
const RATE_LIMIT = 10 // 单 openid 24h 内交卷上限（防脚本刷报告数/「N 人已测」）
const DIMS = ['insight', 'creativity', 'action', 'collab', 'stability']

// 题库合法选项映射（qid → 选项 key 列表）。与 src/data/questions-* 同步维护，
// 题库升版时必须同步此处（报告按 bankVersion 存档，旧报告不受影响）。
const BANK = {
  fun: {
    'fun-01': ['A', 'B', 'C', 'D'],
    'fun-02': ['A', 'B', 'C', 'D'],
    'fun-03': ['A', 'B', 'C', 'D'],
    'fun-04': ['A', 'B', 'C', 'D'],
    'fun-05': ['A', 'B', 'C', 'D'],
    'fun-06': ['A', 'B', 'C', 'D']
  },
  pro: {
    'pro-01': ['A', 'B', 'C', 'D'],
    'pro-02': ['A', 'B', 'C', 'D'],
    'pro-03': ['A', 'B', 'C', 'D'],
    'pro-04': ['A', 'B', 'C', 'D'],
    'pro-05': ['A', 'B', 'C', 'D'],
    'pro-06': ['A', 'B', 'C', 'D'],
    'pro-07': ['A', 'B', 'C', 'D'],
    'pro-08': ['A', 'B', 'C', 'D'],
    'pro-09': ['A', 'B', 'C', 'D'],
    'pro-10': ['A', 'B', 'C', 'D'],
    'pro-11': ['A', 'B'], // 迫选二选一
    'pro-12': ['A', 'B']
  }
}

/**
 * 云端逐题校验（与前端 isSessionComplete 同口径的硬化版，防绕过）：
 * qid 不多不少、选项 key 必须命中题库、作答值须为 {key, ms} 且耗时在合理区间。
 * 键数统计不可靠（盲审修订同步到云端）。
 */
function validateAnswers(version, answers) {
  const bank = BANK[version]
  if (!bank || !answers || typeof answers !== 'object' || Array.isArray(answers)) return false
  const ids = Object.keys(bank)
  if (Object.keys(answers).length !== ids.length) return false
  return ids.every(id => {
    const a = answers[id]
    if (!a || typeof a !== 'object' || Array.isArray(a)) return false
    if (!bank[id].includes(a.key)) return false
    return typeof a.ms === 'number' && a.ms >= 0 && a.ms <= DAY
  })
}

/** result 结构校验：计分仍由前端 computeResult 产出（「前端厚」架构取舍），云端拦截脏数据与明显伪造 */
function validateResult(version, result) {
  if (!result || typeof result !== 'object' || result.version !== version) return false
  if (typeof result.archetypeName !== 'string' || !result.archetypeName || result.archetypeName.length > 60) return false
  if (!result.scores || DIMS.some(d => {
    const v = result.scores[d]
    return typeof v !== 'number' || v < 35 || v > 99
  })) return false
  if (!Array.isArray(result.topDims) || result.topDims.length !== DIMS.length) return false
  return result.topDims.every(d => DIMS.includes(d))
}

/** 报告计数：事务外 best-effort；计数文档不存在时创建（失败不影响交卷） */
async function bumpCounter() {
  try {
    const r = await db.collection('counters').doc('reports').update({ data: { reportsTotal: _.inc(1) } })
    if (r && r.stats && r.stats.updated === 0) throw new Error('NO_COUNTER_DOC')
  } catch (e) {
    await db.collection('counters').add({ data: { _id: 'reports', reportsTotal: 1 } }).catch(() => {})
  }
}

/** 按 docId 查已存在的报告：本人 → 幂等成功；他人 → 冲突；不存在 → null */
async function existingReport(sessionId, openid) {
  const doc = await db.collection('reports').doc(sessionId).get()
    .then(d => (Array.isArray(d.data) ? d.data[0] : d.data))
    .catch(() => null)
  if (!doc) return null
  return doc.openid === openid
    ? { ok: true, reportId: sessionId, duplicate: true }
    : { ok: false, error: 'SESSION_CONFLICT' }
}

/**
 * 交卷（幂等核心，03 §5）：
 * - 幂等前置（二轮盲审技术 H1）：先按 reports.doc(sessionId) 查——本人已交过直接返回，不进任何订单逻辑。
 *   原顺序「先查 paid 订单」会让「交卷成功但响应丢失」的重试拿到 NO_PAID_ORDER，被引导二次付款
 * - 云端逐题校验 + result 结构校验 + 24h 频控
 * - PRO：先查一笔 paid 订单（事务外），事务内按 docId 复核 paid → 条件更新 consumed → 同事务写入 reports
 * - 事务冲突重试 ≤3；订单被并发核销时先复查报告（可能正是本会话的并发请求写入），再换下一笔
 * - 计数移出事务 best-effort（二轮盲审技术 M1：全局计数器在事务内成写热点）
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { sessionId, version, result, answers } = event || {}
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }
  if (typeof sessionId !== 'string' || !/^[a-zA-Z0-9-]{8,64}$/.test(sessionId)) {
    return { ok: false, error: 'BAD_REQUEST' }
  }
  if (!version || !EXPECTED[version]) return { ok: false, error: 'BAD_REQUEST' }

  if (!validateAnswers(version, answers)) return { ok: false, error: 'INVALID_ANSWERS' }
  if (!validateResult(version, result)) return { ok: false, error: 'INVALID_RESULT' }

  const dup = await existingReport(sessionId, OPENID)
  if (dup) return dup

  // 频控：计数失败不拦截交卷
  try {
    const recent = await db.collection('reports')
      .where({ openid: OPENID, createdAt: _.gt(Date.now() - DAY) })
      .count()
    if (recent.total >= RATE_LIMIT) return { ok: false, error: 'RATE_LIMITED' }
  } catch (e) { /* ignore */ }

  // PRO：找最早一笔已支付未核销订单
  let order = null
  if (version === 'pro') {
    const q = await db.collection('orders')
      .where({ openid: OPENID, status: 'paid' })
      .orderBy('createdAt', 'asc')
      .limit(1)
      .get()
    order = q.data && q.data[0]
    if (!order) return { ok: false, error: 'NO_PAID_ORDER' }
  }

  const now = Date.now()
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    try {
      await db.runTransaction(async (t) => {
        if (version === 'pro' && order) {
          // 事务内按 docId 复核仍为 paid（条件消费，防并发双花）
          const o = await t.collection('orders').doc(order._id).get()
          const od = Array.isArray(o.data) ? o.data[0] : o.data
          if (!od || od.status !== 'paid') throw new Error('ORDER_CONFLICT')
          await t.collection('orders').doc(order._id).update({
            data: { status: 'consumed', consumedAt: now, reportId: sessionId }
          })
        }
        await t.collection('reports').add({
          data: { _id: sessionId, openid: OPENID, version, result, answers, createdAt: now, updatedAt: now }
        })
      })
      await bumpCounter()
      return { ok: true, reportId: sessionId }
    } catch (e) {
      const msg = (e && e.message) || ''
      if (msg === 'ORDER_CONFLICT') {
        // 可能是本会话的并发请求（如双击交卷）已核销并写入报告：先复查，命中即幂等成功
        const again = await existingReport(sessionId, OPENID)
        if (again) return again
        // 该订单被他端核销：换下一笔 paid 订单重试（排除刚冲突的这笔，防同单死循环）
        const q2 = await db.collection('orders')
          .where({ openid: OPENID, status: 'paid' })
          .orderBy('createdAt', 'asc')
          .limit(2)
          .get()
        const next = (q2.data || []).find(o => o._id !== (order && order._id))
        if (!next) return { ok: false, error: 'NO_PAID_ORDER' }
        order = next
        continue
      }
      // 并发请求已写入同 sessionId：校验归属
      const existing = await existingReport(sessionId, OPENID)
      if (existing) return existing
      // 其余（事务写冲突）：重试
    }
  }
  return { ok: false, error: 'SUBMIT_CONFLICT' }
}
