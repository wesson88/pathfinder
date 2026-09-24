const crypto = require('crypto')
const cloud = require('wx-server-sdk')
const xpay = require('./xpay')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const RECENT = 2 * 3600 * 1000 // 下单前复核的 created 单时间窗

/**
 * platform 来自客户端，不可信（三轮盲审文档 M1）：只用于选道具与展示价；
 * iOS 端若伪报为安卓，拉起时道具/价格与平台配置不符会被平台拒绝（沙箱待验证）。
 */
const PLATFORMS = ['android', 'ios', 'windows', 'mac', 'devtools', 'ohos']

/**
 * 下单（D25 全终端小程序虚拟支付，04 §3）：
 * 1. 服务端防重复收款：已有 paid 未核销订单 → 拒绝下单；近 2h 的 created 单先权威查单，
 *    已支付则补写并拒绝下单，查单异常也拒绝（三轮盲审 N3：支付 fail 回调先到但实际已扣款时的二次扣款）
 * 2. wx.login code 换 session_key，openid 须与云调用上下文一致
 * 3. 落 orders(created)，单号高熵（二轮盲审技术 H2：原「毫秒+3 位随机」可碰撞）
 * 4. 构造 signData 并签名，返回前端 wx.requestVirtualPayment 参数
 * 价格按平台由 xpay.PRICE 决定，前端传入金额一律不采信。
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { code, platform: rawPlatform } = event || {}
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }
  if (!xpay.isConfigured()) return { ok: false, error: 'XPAY_NOT_CONFIGURED' }
  if (typeof code !== 'string' || !code) return { ok: false, error: 'BAD_REQUEST' }
  const platform = PLATFORMS.includes(rawPlatform) ? rawPlatform : 'android'

  try {
    const paid = await db.collection('orders').where({ openid: OPENID, status: 'paid', channel: 'xpay' }).count()
    if (paid.total > 0) return { ok: false, error: 'HAS_PAID_UNUSED' }
    const recent = await db.collection('orders')
      .where({ openid: OPENID, status: 'created', channel: 'xpay', createdAt: _.gt(Date.now() - RECENT) })
      .limit(3)
      .get()
    for (const o of recent.data || []) {
      let v
      try {
        v = await xpay.queryOrder(OPENID, o.outTradeNo)
      } catch (err) {
        // 平台明确回了错误码（如从未拉起支付的单不存在）= 已处理请求且非已支付，放行；
        // 网络/超时等状态不明 → 抛出，拒绝下单
        if (err && err.errcode != null) continue
        throw err
      }
      if (v.paid) {
        await db.collection('orders')
          .where({ _id: o._id, openid: OPENID, status: 'created' })
          .update({ data: { status: 'paid', paidAt: Date.now(), queryRaw: v.raw } })
        await xpay.notifyProvideGoods(o.outTradeNo).catch(() => {})
        return { ok: false, error: 'HAS_PAID_UNUSED' }
      }
    }
  } catch (e) {
    return { ok: false, error: 'CHECK_FAILED' }
  }

  let sessionKey
  try {
    sessionKey = await xpay.sessionKeyOf(code, OPENID)
  } catch (e) {
    return { ok: false, error: 'SESSION_FAILED' }
  }

  const outTradeNo = `ct${Date.now()}${crypto.randomBytes(8).toString('hex')}`
  try {
    await db.collection('orders').add({
      data: {
        _id: outTradeNo,
        outTradeNo,
        openid: OPENID,
        channel: 'xpay',
        platform,
        totalFee: platform === 'ios' ? xpay.PRICE.ios : xpay.PRICE.default,
        status: 'created',
        createdAt: Date.now()
      }
    })
  } catch (e) {
    // add 失败：库里没有本次订单，不做任何关单（绝不按单号跨用户关单）
    return { ok: false, error: 'ORDER_FAILED' }
  }

  try {
    const payParams = xpay.buildPayParams({ outTradeNo, platform, sessionKey })
    return { ok: true, outTradeNo, payParams }
  } catch (e) {
    // 仅关闭本人本次刚写入的订单
    try {
      await db.collection('orders').where({ _id: outTradeNo, openid: OPENID, status: 'created' })
        .update({ data: { status: 'closed' } })
    } catch (e2) { /* 留在 created：24h 后 checkOrder 查单确认未支付再惰性关单 */ }
    return { ok: false, error: 'ORDER_FAILED' }
  }
}
