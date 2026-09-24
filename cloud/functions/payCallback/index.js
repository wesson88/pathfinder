const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// TODO 联调前必填：与 createOrder 一致的商户号（建议环境变量注入）；未配置时拒绝落账
const MCH_ID = process.env.WECHAT_MCH_ID || ''

/**
 * 微信支付异步回调（D14 保险①）。
 * 安全（盲审修复）：云函数可被任意登录端 callFunction 直调，事件里的
 * returnCode/resultCode 均属客户端可伪造字段，不可作为落账依据。
 * 故一律以 cloudPay.queryOrder 的权威查单结果落账：事件仅提供 outTradeNo 入参，
 * 且必须命中本地 created 订单（where 条件保证）才可能被置为 paid。
 * 条件更新 status='created' → 'paid'：与 checkOrder 补写并发互覆 callbackRaw（04 §4）。
 */
exports.main = async (event) => {
  const { outTradeNo } = event || {}
  let verified = null

  if (outTradeNo && MCH_ID) {
    try {
      const r = await cloud.cloudPay.queryOrder({
        subMchId: MCH_ID,
        outTradeNo,
        nonceStr: `n${Date.now()}`
      })
      if (r && r.returnCode === 'SUCCESS' && r.tradeState === 'SUCCESS') verified = r
    } catch (e) { /* 查单失败不落账：checkOrder 轮询（保险②）会兜底补写 */ }

    if (verified) {
      try {
        await db.collection('orders')
          .where({ outTradeNo, status: 'created' })
          .update({
            data: {
              status: 'paid',
              paidAt: Date.now(),
              callbackRaw: JSON.stringify(verified).slice(0, 2000)
            }
          })
      } catch (e) {
        // 落账失败不阻塞应答：checkOrder 轮询（保险②）会兜底补写
      }
    }
  }

  // cloudPay 要求固定应答
  return { errcode: 0, errmsg: '' }
}
