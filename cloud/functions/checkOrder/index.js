const cloud = require('wx-server-sdk')
const xpay = require('./xpay')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const HOUR = 3600 * 1000
const DAY = 24 * HOUR
const STALE_PAID = 48 * HOUR // 已支付未核销超 48h 提示（04 §2 铁律 4）
const MAX_CHECK = 10 // 单次查单的 created 订单数上限

/**
 * 查单（D14 保险②，04 §4）：
 * 1. 本地已有 paid → hasPaidUnused；最早一笔超 48h → stalePaid
 * 2. 最近 10 笔 created 单并发 xpay 权威查单：任一已支付 → 条件补写 paid + 告知发货
 * 3. created 超 24h 且平台明确已关闭 → 惰性关单；状态不明一律不动
 * 查单失败返回 ok:false（二轮盲审技术 M2：原异常时伪装成「未支付」，会放行重复下单）
 */
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }

  try {
    const paid = await db.collection('orders')
      .where({ openid: OPENID, status: 'paid' })
      .orderBy('paidAt', 'asc')
      .limit(1)
      .get()
    const oldest = paid.data && paid.data[0]
    if (oldest) {
      return { ok: true, hasPaidUnused: true, stalePaid: Date.now() - (oldest.paidAt || 0) > STALE_PAID }
    }

    const q = await db.collection('orders')
      .where({ openid: OPENID, status: 'created' })
      .orderBy('createdAt', 'desc')
      .limit(MAX_CHECK)
      .get()
    const orders = (q.data || []).filter(o => o && o.outTradeNo)
    if (!orders.length || !xpay.isConfigured()) return { ok: true, hasPaidUnused: false }

    // 并发查单（调用方为 1.2s 间隔轮询，串行会放大尾延迟）
    const results = await Promise.allSettled(orders.map(o => xpay.queryOrder(OPENID, o.outTradeNo)))

    let hit = null
    const toClose = []
    results.forEach((r, i) => {
      if (r.status !== 'fulfilled') return // 查单异常：状态未知，不动
      if (r.value.paid && !hit) hit = { order: orders[i], raw: r.value.raw }
      else if (r.value.closed && Date.now() - (orders[i].createdAt || 0) > DAY) toClose.push(orders[i])
    })

    if (hit) {
      await db.collection('orders')
        .where({ _id: hit.order.outTradeNo, openid: OPENID, status: 'created' })
        .update({ data: { status: 'paid', paidAt: Date.now(), queryRaw: hit.raw } })
      await xpay.notifyProvideGoods(hit.order.outTradeNo).catch(() => {})
      return { ok: true, hasPaidUnused: true, stalePaid: false }
    }

    await Promise.allSettled(toClose.map(o =>
      db.collection('orders')
        .where({ _id: o.outTradeNo, openid: OPENID, status: 'created' })
        .update({ data: { status: 'closed' } })
    ))
    return { ok: true, hasPaidUnused: false }
  } catch (e) {
    return { ok: false, error: 'CHECK_FAILED' }
  }
}
