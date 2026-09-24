const cloud = require('wx-server-sdk')
const xpay = require('./xpay')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const HOUR = 3600 * 1000
const DAY = 24 * HOUR
const STALE_PAID = 48 * HOUR // 已支付未核销超 48h 提示（04 §2 铁律 4）
const MAX_PAID_CHECK = 3 // 单次复核的 paid 单上限（退款回收）
const MAX_CREATED_CHECK = 5 // 单次查单的 created 单上限
const GIVE_UP_AFTER = 72 * HOUR // 查单持续异常超过该时长的 created 单视为无效关闭

/** 权益有效的 paid 单：虚拟支付通道 + 有权威查单原文（三轮盲审 N2：挡住客户端伪造的 paid 文档） */
const validPaid = o => o && o.channel === 'xpay' && typeof o.queryRaw === 'string' && o.queryRaw.length > 0

/**
 * 查单（D14 保险②，04 §4）：
 * 1. paid 单逐笔权威复核：已退款（含 iOS 苹果侧退款）→ 回收为 refunded（三轮盲审 N7）；仍有效 → hasPaidUnused
 * 2. created 单并发查单：任一已支付 → 条件补写 paid + 告知发货
 * 3. 超 24h 且确认未支付、或查单持续异常超 72h 的 created 单 → 关单，不再每次重查（三轮盲审技术 M3）
 * 近期单查单异常 → ok:false，绝不伪装成「未支付」放行下单
 */
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }

  try {
    const paid = await db.collection('orders')
      .where({ openid: OPENID, status: 'paid' })
      .orderBy('paidAt', 'asc')
      .limit(MAX_PAID_CHECK)
      .get()
    for (const o of (paid.data || []).filter(validPaid)) {
      let refunded = false
      try {
        refunded = (await xpay.queryOrder(OPENID, o.outTradeNo)).refunded
      } catch (e) { /* 复核失败不影响已有权益 */ }
      if (refunded) {
        await db.collection('orders')
          .where({ _id: o._id, openid: OPENID, status: 'paid' })
          .update({ data: { status: 'refunded', refundedAt: Date.now() } })
        continue
      }
      return { ok: true, hasPaidUnused: true, stalePaid: Date.now() - (o.paidAt || 0) > STALE_PAID }
    }

    if (!xpay.isConfigured()) return { ok: true, hasPaidUnused: false }
    const q = await db.collection('orders')
      .where({ openid: OPENID, status: 'created', channel: 'xpay' })
      .orderBy('createdAt', 'desc')
      .limit(MAX_CREATED_CHECK)
      .get()
    const orders = q.data || []
    if (!orders.length) return { ok: true, hasPaidUnused: false }

    const results = await Promise.allSettled(orders.map(o => xpay.queryOrder(OPENID, o.outTradeNo)))
    let hit = null
    const toClose = []
    let unknownRecent = false
    results.forEach((r, i) => {
      const age = Date.now() - (orders[i].createdAt || 0)
      if (r.status === 'fulfilled') {
        if (r.value.paid && !hit) hit = { order: orders[i], raw: r.value.raw }
        else if (!r.value.paid && age > DAY) toClose.push(orders[i])
      } else if (r.reason && r.reason.errcode != null) {
        // 平台明确回了错误码（单不存在等）：非已支付；超 24h 关单
        if (age > DAY) toClose.push(orders[i])
      } else if (age > GIVE_UP_AFTER) {
        toClose.push(orders[i])
      } else {
        unknownRecent = true
      }
    })

    if (hit) {
      await db.collection('orders')
        .where({ _id: hit.order._id, openid: OPENID, status: 'created' })
        .update({ data: { status: 'paid', paidAt: Date.now(), queryRaw: hit.raw } })
      await xpay.notifyProvideGoods(hit.order.outTradeNo).catch(() => {})
      return { ok: true, hasPaidUnused: true, stalePaid: false }
    }

    await Promise.allSettled(toClose.map(o =>
      db.collection('orders')
        .where({ _id: o._id, openid: OPENID, status: 'created' })
        .update({ data: { status: 'closed' } })
    ))
    // 近期单状态未知：不能断言「未支付」
    if (unknownRecent) return { ok: false, error: 'CHECK_FAILED' }
    return { ok: true, hasPaidUnused: false }
  } catch (e) {
    return { ok: false, error: 'CHECK_FAILED' }
  }
}
