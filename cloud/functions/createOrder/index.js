const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// TODO 联调前必填：微信支付商户号（商户平台获取），建议改为云函数环境变量注入
const MCH_ID = process.env.WECHAT_MCH_ID || ''

// 价格唯一事实源：硬编码 99（分），前端传入金额一律不采信（M4 §5 防篡改）
const TOTAL_FEE = 99

/** 下单：落 orders(created) → cloudPay 统一下单 → 返回 payment 供前端拉起收银台 */
exports.main = async () => {
  const { OPENID, ENV } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }
  if (!MCH_ID) return { ok: false, error: 'MCH_NOT_CONFIGURED' }

  const outTradeNo = `ct${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
  const now = Date.now()

  try {
    await db.collection('orders').add({
      data: {
        _id: outTradeNo,
        outTradeNo,
        openid: OPENID,
        channel: 'cloudpay',
        totalFee: TOTAL_FEE,
        status: 'created',
        createdAt: now
      }
    })

    const res = await cloud.cloudPay.unifiedOrder({
      body: '天赋星球 PRO 专业版',
      outTradeNo,
      spbillCreateIp: '127.0.0.1',
      subMchId: MCH_ID,
      totalFee: TOTAL_FEE,
      envId: ENV,
      functionName: 'payCallback',
      tradeTypeId: 5
    })

    if (!res || res.returnCode !== 'SUCCESS' || !res.payment) {
      await db.collection('orders').where({ outTradeNo, status: 'created' }).update({ data: { status: 'closed' } })
      return { ok: false, error: 'ORDER_FAILED' }
    }

    return { ok: true, outTradeNo, payment: res.payment }
  } catch (e) {
    try {
      await db.collection('orders').where({ outTradeNo, status: 'created' }).update({ data: { status: 'closed' } })
    } catch (e2) { /* ignore */ }
    return { ok: false, error: 'ORDER_FAILED' }
  }
}
