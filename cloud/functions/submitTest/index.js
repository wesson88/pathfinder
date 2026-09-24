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

/**
 * 交卷（幂等核心，03 §5 盲审重构版）：
 * - 报告 docId = sessionId：重复提交天然去重（set 语义由「add + 查重」实现，避免重复计数）
 * - 云端逐题校验 + result 结构校验 + 24h 频控（盲审修复：原仅有键数统计，六键垃圾卷可直写 reports）
 * - PRO：先查一笔 paid 订单（事务外），事务内按 docId 复核 paid → 条件更新 consumed → 同事务写入 reports + 递增 counters
 * - 事务冲突重试 ≤3；订单被并发核销则换下一笔
 * - 幂等去重校验归属：本人重复提交幂等成功；sessionId 被他人占用则明确报错（盲审修复：原判定不校验归属，会静默吞单）
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
        try {
          await t.collection('counters').doc('reports').update({ data: { reportsTotal: _.inc(1) } })
        } catch (e) {
          await t.collection('counters').add({ data: { _id: 'reports', reportsTotal: 1 } })
        }
      })
      return { ok: true, reportId: sessionId }
    } catch (e) {
      const msg = (e && e.message) || ''
      if (msg === 'ORDER_CONFLICT') {
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
      // 同 sessionId 已存在：校验归属
      const existing = await db.collection('reports').doc(sessionId).get()
        .then(d => d.data).catch(() => null)
      if (existing) {
        const owner = Array.isArray(existing) ? existing[0] : existing
        if (owner && owner.openid === OPENID) return { ok: true, reportId: sessionId, duplicate: true }
        return { ok: false, error: 'SESSION_CONFLICT' }
      }
      // 其余（事务写冲突）：重试
    }
  }
  return { ok: false, error: 'SUBMIT_CONFLICT' }
}
