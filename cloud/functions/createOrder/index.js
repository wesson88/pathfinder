const crypto = require('crypto')
const cloud = require('wx-server-sdk')
const xpay = require('./xpay')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const PLATFORMS = ['android', 'ios', 'windows', 'mac', 'devtools', 'ohos']

/**
 * 下单（D25 全终端小程序虚拟支付，04 §3）：
 * 1. 服务端防重复收款：已有 paid 未核销订单 → 拒绝下单（04 §2 铁律 1 的云端兜底）
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
    const paid = await db.collection('orders').where({ openid: OPENID, status: 'paid' }).count()
    if (paid.total > 0) return { ok: false, error: 'HAS_PAID_UNUSED' }
  } catch (e) {
    return { ok: false, error: 'ORDER_FAILED' }
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
