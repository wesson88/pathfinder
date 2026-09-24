const crypto = require('crypto')
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 集合不存在（如已下线的 sessions）视为无数据可删
const COLLECTION_NOT_EXIST = -502005

/**
 * 「清除我的数据」（D15，05 §4）：
 * - 逐集合删除 reports / feedback / events（及历史遗留 sessions），逐项收集结果；任一失败返回 ok:false，
 *   前端提示可重试（操作幂等）。二轮盲审 X6：原实现吞掉异常照样返回 ok，界面还先于云端提示「已清除」
 * - orders：paid 未核销与 created（可能已付款待落账）订单保留归属与查单原文——
 *   匿名化 created 单会让之后的查单用假 openid 永远失败、扣款无权益（三轮盲审 N6）；
 *   consumed / closed / refunded 订单 openid 替换为随机不可逆标识并清空查单原文
 * - 报告删除后回减计数
 * - 删除完成后不写任何带 openid 的事件
 */
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }

  const failed = []
  const removed = {}

  for (const name of ['reports', 'feedback', 'events', 'sessions']) {
    try {
      const r = await db.collection(name).where({ openid: OPENID }).remove()
      removed[name] = (r.stats && r.stats.removed) || 0
    } catch (e) {
      if (e && e.errCode === COLLECTION_NOT_EXIST) removed[name] = 0
      else failed.push(name)
    }
  }

  if (removed.reports > 0) {
    try {
      await db.collection('counters').doc('reports').update({ data: { reportsTotal: _.inc(-removed.reports) } })
    } catch (e) { /* 计数偏差不影响删除结果；展示层仅在 >0 时展示 */ }
  }

  try {
    await db.collection('orders')
      .where({ openid: OPENID, status: _.in(['consumed', 'closed', 'refunded']) })
      .update({
        data: {
          openid: `deleted-${crypto.randomBytes(12).toString('hex')}`,
          queryRaw: '',
          callbackRaw: _.remove()
        }
      })
  } catch (e) {
    failed.push('orders')
  }

  if (failed.length) return { ok: false, error: 'PARTIAL_FAILED', failed, removed }
  return { ok: true, removed }
}
