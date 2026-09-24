const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 「清除我的数据」（D15）：删除报告、作答会话、事件、反馈；
 * 订单匿名化保留（财务凭证要求），openid 置为固定匿名标记。
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

  try {
    await db.collection('orders')
      .where({ openid: OPENID })
      .update({ data: { openid: 'anonymized' } })
  } catch (e) { /* 匿名化失败不阻塞删除应答 */ }

  return { ok: true, removed: { reports, sessions, events, feedback } }
}
