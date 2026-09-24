const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 微信支付异步回调（D14 保险①）。
 * 条件更新 status='created' → 'paid'：与 checkOrder 补写并发互覆 callbackRaw（04 §4）。
 * TODO 联调：cloudPay 回调签名校验需商户密钥，接入后先验签再落账。
 */
exports.main = async (event) => {
  const { returnCode, resultCode, outTradeNo } = event || {}

  if (returnCode === 'SUCCESS' && resultCode === 'SUCCESS' && outTradeNo) {
    try {
      await db.collection('orders')
        .where({ outTradeNo, status: 'created' })
        .update({
          data: {
            status: 'paid',
            paidAt: Date.now(),
            callbackRaw: JSON.stringify(event).slice(0, 2000)
          }
        })
    } catch (e) {
      // 落账失败不阻塞应答：checkOrder 轮询（保险②）会兜底补写
    }
  }

  // cloudPay 要求固定应答
  return { errcode: 0, errmsg: '' }
}
