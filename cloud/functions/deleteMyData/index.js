const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 「清除我的数据」（D15）：删除报告、作答会话、事件、反馈；
 * 订单匿名化保留（财务凭证要求）——但已支付订单保留归属（盲审修复：
 * 原逻辑连 paid 单一并匿名化，会误伤 submitTest/checkOrder 按 openid 查找的付费权益），
 * 仅匿名化其余状态订单。报告删除后回减 counters，保持「N 人已测」真实。
 */
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }

  const removeByOpenid = async (name) => {
    try {
      const r = await db.collection(name).where({ openid: OPENID }).remove()
      return (r.stats && r.stats.removed) || 0
    } catch (e) {
      return 0
    }
  }

  const reports = await removeByOpenid('reports')
  const sessions = await removeByOpenid('sessions')
  const events = await removeByOpenid('events')
  const feedback = await removeByOpenid('feedback')

  // 回减计数（失败不影响删除应答；不可为负由展示层兜底：home 仅在 >0 时展示）
  if (reports > 0) {
    try {
      await db.collection('counters').doc('reports').update({ data: { reportsTotal: _.inc(-reports) } })
    } catch (e) { /* ignore */ }
  }

  try {
    await db.collection('orders')
      .where({ openid: OPENID, status: _.neq('paid') })
      .update({ data: { openid: 'anonymized' } })
  } catch (e) { /* 匿名化失败不阻塞删除应答 */ }

  return { ok: true, removed: { reports, sessions, events, feedback } }
}
