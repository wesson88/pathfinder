const cloud = require('wx-server-sdk')
const xpay = require('./xpay')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const ok = () => ({ ErrCode: 0, ErrMsg: 'success' })
const retry = (msg) => ({ ErrCode: 1, ErrMsg: msg })

/**
 * 虚拟支付发货推送 xpay_goods_deliver_notify（D14 保险①，04 §4）。
 * 在云开发「消息推送」中把该事件指向本云函数。
 * 安全：云函数可被任意登录端 callFunction 直调，推送字段一律不作为落账依据——
 * 仅取单号定位本地订单，以 xpay/query_order 权威查单结果落账（条件更新 created → paid）。
 * 查单或落账失败返回非 0 ErrCode，让平台重推（二轮盲审技术 M3：原固定应答成功，失败不会重推）。
 */
exports.main = async (event) => {
  const e = event || {}
  const outTradeNo = e.OutTradeNo || e.outTradeNo
  if (typeof outTradeNo !== 'string' || !outTradeNo) return ok()
  if (!xpay.isConfigured()) return retry('NOT_CONFIGURED')

  let order
  try {
    const d = await db.collection('orders').doc(outTradeNo).get()
    order = Array.isArray(d.data) ? d.data[0] : d.data
  } catch (err) {
    order = null
  }
  // 非本系统订单：无事可做，应答成功以免无限重推
  if (!order) return ok()

  if (order.status === 'paid' || order.status === 'consumed') {
    await xpay.notifyProvideGoods(outTradeNo).catch(() => {})
    return ok()
  }
  if (order.status !== 'created') return ok()

  let verified
  try {
    verified = await xpay.queryOrder(order.openid, outTradeNo)
  } catch (err) {
    return retry('QUERY_FAILED')
  }
  if (!verified.paid) return retry('NOT_PAID_YET')

  try {
    await db.collection('orders')
      .where({ _id: outTradeNo, status: 'created' })
      .update({ data: { status: 'paid', paidAt: Date.now(), queryRaw: verified.raw } })
  } catch (err) {
    return retry('WRITE_FAILED')
  }
  await xpay.notifyProvideGoods(outTradeNo).catch(() => {})
  return ok()
}
