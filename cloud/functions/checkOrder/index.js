const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// TODO 联调前必填：与 createOrder 一致的商户号（建议环境变量注入）
const MCH_ID = process.env.WECHAT_MCH_ID || ''

const DAY = 24 * 3600 * 1000
const MAX_CHECK = 10 // 单次查单的 created 订单数上限（每次点击下单都会新建订单）
// 微信侧明确的终态未支付：仅这些状态允许惰性关单
const CLOSED_STATES = ['NOTPAY', 'CLOSED', 'REVOKED', 'PAYERROR']

/**
 * 查单（D14 保险②，盲审修复后）：
 * 1. 本地已有 paid → 直接 true
 * 2. 全部 created 单（取最近 10 笔）并发 cloudPay 查单：任一 SUCCESS → 条件补写 paid
 *    （盲审修复：原只查最新一笔，二次下单会遮蔽更早的真实已付单）
 * 3. created 超 24h 且微信侧明确未支付/已关闭 → 惰性关单（M4 §2，不做定时任务）
 *    （盲审修复：查单异常/状态未知一律保留订单，绝不在状态不明时关单，防误关已付单）
 */
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }

  try {
    const paidCount = await db.collection('orders').where({ openid: OPENID, status: 'paid' }).count()
    if (paidCount.total > 0) return { ok: true, hasPaidUnused: true }

    if (!MCH_ID) return { ok: true, hasPaidUnused: false }

    const q = await db.collection('orders')
      .where({ openid: OPENID, status: 'created' })
      .orderBy('createdAt', 'desc')
      .limit(MAX_CHECK)
      .get()
    const orders = (q.data || []).filter(o => o && o.outTradeNo)
    if (!orders.length) return { ok: true, hasPaidUnused: false }

    // 并发查单（调用方为 1.2s 间隔轮询，串行会放大尾延迟）
    const results = await Promise.allSettled(
      orders.map(o => cloud.cloudPay.queryOrder({
        subMchId: MCH_ID,
        outTradeNo: o.outTradeNo,
        nonceStr: `n${Date.now()}`
      }))
    )

    let paidHit = null // { order, raw }
    const toClose = []
    results.forEach((r, i) => {
      const order = orders[i]
      if (r.status !== 'fulfilled') return // 查单异常：状态未知，不动
      const res = r.value
      if (!res || res.returnCode !== 'SUCCESS') return // 通信级失败：状态未知
      if (res.tradeState === 'SUCCESS') {
        if (!paidHit) paidHit = { order, raw: res }
        return
      }
      if (CLOSED_STATES.includes(res.tradeState) && Date.now() - (order.createdAt || 0) > DAY) {
        toClose.push(order)
      }
    })

    if (paidHit) {
      try {
        await db.collection('orders')
          .where({ outTradeNo: paidHit.order.outTradeNo, status: 'created' })
          .update({
            data: { status: 'paid', paidAt: Date.now(), callbackRaw: JSON.stringify(paidHit.raw).slice(0, 2000) }
          })
      } catch (e) { /* 补写失败：下次轮询重试 */ }
      return { ok: true, hasPaidUnused: true }
    }

    // 惰性关单（仅在微信侧明确终态未支付时）
    await Promise.allSettled(toClose.map(o =>
      db.collection('orders')
        .where({ outTradeNo: o.outTradeNo, status: 'created' })
        .update({ data: { status: 'closed' } })
    ))

    return { ok: true, hasPaidUnused: false }
  } catch (e) {
    return { ok: true, hasPaidUnused: false }
  }
}
