const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const EXPECTED = { fun: 6, pro: 12 }
const MAX_RETRY = 3 // 事务冲突重试上限（03 §5）

/**
 * 交卷（幂等核心，03 §5 盲审重构版）：
 * - 报告 docId = sessionId：重复提交天然去重（set 语义由「add + 查重」实现，避免重复计数）
 * - PRO：先查一笔 paid 订单（事务外），事务内按 docId 复核 paid → 条件更新 consumed → 同事务写入 reports + 递增 counters
 * - 事务冲突重试 ≤3；订单被并发核销则换下一笔
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { sessionId, version, result, answers } = event || {}
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }
  if (!sessionId || !version || !result || !EXPECTED[version]) return { ok: false, error: 'BAD_REQUEST' }

  // 云端完成度兜底校验（前端已守门，防绕过）
  if (!answers || Object.keys(answers).length < EXPECTED[version]) {
    return { ok: false, error: 'INCOMPLETE_ANSWERS' }
  }

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
        // 该订单被他端核销：换下一笔 paid 订单重试
        const q2 = await db.collection('orders')
          .where({ openid: OPENID, status: 'paid' })
          .orderBy('createdAt', 'asc')
          .limit(1)
          .get()
        order = q2.data && q2.data[0]
        if (!order) return { ok: false, error: 'NO_PAID_ORDER' }
        continue
      }
      // 同 sessionId 已存在 = 重复提交：幂等成功返回，不重复计数
      const dup = await db.collection('reports').doc(sessionId).get().then(() => true).catch(() => false)
      if (dup) return { ok: true, reportId: sessionId, duplicate: true }
      // 其余（事务写冲突）：重试
    }
  }
  return { ok: false, error: 'SUBMIT_CONFLICT' }
}
