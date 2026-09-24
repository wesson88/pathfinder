const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// TODO 联调前必填：与 createOrder 一致的商户号（建议环境变量注入）
const MCH_ID = process.env.WECHAT_MCH_ID || ''

const DAY = 24 * 3600 * 1000

/**
 * 查单（D14 保险②）：
 * 1. 本地已有 paid → 直接 true
 * 2. 最近 created 单 → cloudPay 主动查单：SUCCESS 则条件补写 paid（防与回调互覆）
 * 3. created 超 24h → 惰性关单（M4 §2，不做定时任务）
 */
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }

  try {
    const paidCount = await db.collection('orders').where({ openid: OPENID, status: 'paid' }).count()
    if (paidCount.total > 0) return { ok: true, hasPaidUnused: true }

    const q = await db.collection('orders')
      .where({ openid: OPENID, status: 'created' })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()
    const order = q.data && q.data[0]

    if (order && MCH_ID) {
      try {
        const r = await cloud.cloudPay.queryOrder({
          subMchId: MCH_ID,
          outTradeNo: order.outTradeNo,
          nonceStr: `n${Date.now()}`
        })
        if (r && r.returnCode === 'SUCCESS' && r.tradeState === 'SUCCESS') {
          await db.collection('orders')
            .where({ outTradeNo: order.outTradeNo, status: 'created' })
            .update({
              data: { status: 'paid', paidAt: Date.now(), callbackRaw: JSON.stringify(r).slice(0, 2000) }
            })
          return { ok: true, hasPaidUnused: true }
        }
      } catch (e) { /* 查单失败按未支付处理 */ }

      // 惰性关单
      if (Date.now() - (order.createdAt || 0) > DAY) {
        await db.collection('orders')
          .where({ outTradeNo: order.outTradeNo, status: 'created' })
          .update({ data: { status: 'closed' } })
      }
    }

    return { ok: true, hasPaidUnused: false }
  } catch (e) {
    return { ok: true, hasPaidUnused: false }
  }
}
