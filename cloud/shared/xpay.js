/**
 * 小程序虚拟支付（xpay）服务端封装（D25，04 §3）——唯一源文件。
 * 由 scripts/sync-cloud-shared.js 复制到 createOrder / payCallback / checkOrder 目录下的 xpay.js，
 * 云函数目录内的副本勿手改。
 *
 * 签名与接口字段以官方《小程序虚拟支付》文档为准，沙箱联调时逐项核对：
 * - paySig（前端拉起）  = hex(HMAC-SHA256(AppKey, 'requestVirtualPayment&' + signData))
 * - signature（用户态）= hex(HMAC-SHA256(session_key, signData))
 * - pay_sig（服务端接口）= hex(HMAC-SHA256(AppKey, uri + '&' + body))
 *
 * 环境变量（云函数配置，勿入仓库）：
 *   WX_APPID / WX_APPSECRET          小程序凭据（换 session_key、access_token）
 *   XPAY_ENV                         0 正式 / 1 沙箱
 *   XPAY_OFFER_ID                    虚拟支付 OfferId
 *   XPAY_APPKEY                      与 XPAY_ENV 对应的 AppKey（正式/沙箱各一）
 *   XPAY_PRODUCT_ID                  PRO 道具 ID（安卓/PC）
 *   XPAY_PRODUCT_ID_IOS              PRO 道具 ID（iOS 档位价；缺省同上）
 */
const crypto = require('crypto')
const https = require('https')

const cfg = {
  appid: process.env.WX_APPID || '',
  secret: process.env.WX_APPSECRET || '',
  env: Number(process.env.XPAY_ENV || 1),
  offerId: process.env.XPAY_OFFER_ID || '',
  appKey: process.env.XPAY_APPKEY || '',
  productId: process.env.XPAY_PRODUCT_ID || '',
  productIdIos: process.env.XPAY_PRODUCT_ID_IOS || process.env.XPAY_PRODUCT_ID || ''
}

/** 价格唯一事实源（分）：安卓/PC ¥0.99，iOS 苹果档位 ¥1（04 §3）。前端传入金额一律不采信 */
const PRICE = { default: 99, ios: 100 }

const isConfigured = () =>
  !!(cfg.appid && cfg.secret && cfg.offerId && cfg.appKey && cfg.productId)

const hmac = (key, text) => crypto.createHmac('sha256', key).update(text).digest('hex')

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const payload = body == null ? null : typeof body === 'string' ? body : JSON.stringify(body)
    const req = https.request(url, {
      method,
      timeout: 5000,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}
    }, res => {
      let data = ''
      res.on('data', c => (data += c))
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch (e) { reject(new Error('XPAY_BAD_RESPONSE')) }
      })
    })
    req.on('timeout', () => req.destroy(new Error('XPAY_TIMEOUT')))
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

let tokenCache = { value: '', expireAt: 0 }

/** stable_token：同实例内缓存，提前 5 分钟刷新 */
async function accessToken() {
  if (tokenCache.value && Date.now() < tokenCache.expireAt) return tokenCache.value
  const r = await request('POST', 'https://api.weixin.qq.com/cgi-bin/stable_token', {
    grant_type: 'client_credential', appid: cfg.appid, secret: cfg.secret
  })
  if (!r || !r.access_token) throw new Error('XPAY_TOKEN_FAILED')
  tokenCache = { value: r.access_token, expireAt: Date.now() + (r.expires_in - 300) * 1000 }
  return tokenCache.value
}

/** wx.login 的 code 换 session_key；openid 必须与云调用上下文一致 */
async function sessionKeyOf(code, expectOpenid) {
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${cfg.appid}&secret=${cfg.secret}` +
    `&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
  const r = await request('GET', url)
  if (!r || !r.session_key) throw new Error('XPAY_SESSION_FAILED')
  if (r.openid !== expectOpenid) throw new Error('XPAY_OPENID_MISMATCH')
  return r.session_key
}

/** 构造前端 wx.requestVirtualPayment 参数（道具直购） */
function buildPayParams({ outTradeNo, platform, sessionKey }) {
  const ios = platform === 'ios'
  const signData = JSON.stringify({
    offerId: cfg.offerId,
    buyQuantity: 1,
    env: cfg.env,
    currencyType: 'CNY',
    productId: ios ? cfg.productIdIos : cfg.productId,
    goodsPrice: ios ? PRICE.ios : PRICE.default,
    outTradeNo,
    attach: ''
  })
  return {
    mode: 'short_series_goods',
    signData,
    paySig: hmac(cfg.appKey, `requestVirtualPayment&${signData}`),
    signature: hmac(sessionKey, signData)
  }
}

async function serverApi(uri, body) {
  const text = JSON.stringify(body)
  const token = await accessToken()
  const url = `https://api.weixin.qq.com${uri}?access_token=${token}&pay_sig=${hmac(cfg.appKey, `${uri}&${text}`)}`
  const r = await request('POST', url, text)
  if (!r || r.errcode !== 0) throw new Error(`XPAY_API_${r ? r.errcode : 'EMPTY'}`)
  return r
}

/**
 * 订单状态（query_order 返回 order.status，以官方文档为准）：
 * 0 初始化 / 1 创建成功待支付 / 2 已支付待发货 / 3 发货中 / 4 已发货 / 5 已退款 / 6 已关闭 / 7 退款失败 / 8 用户退款完成
 */
const PAID_STATES = [2, 3, 4]
const CLOSED_STATES = [6]

/** 权威查单：返回 { paid, closed, raw }；raw 已剔除 openid（05 §2 queryRaw 口径） */
async function queryOrder(openid, outTradeNo) {
  const r = await serverApi('/xpay/query_order', { openid, env: cfg.env, order_id: outTradeNo })
  const order = r.order || {}
  const { openid: _drop, ...raw } = order
  return {
    paid: PAID_STATES.includes(order.status),
    closed: CLOSED_STATES.includes(order.status),
    raw: JSON.stringify(raw).slice(0, 2000)
  }
}

/** 告知平台已发货（落账 paid 后调用；失败不影响权益，平台会按推送重试） */
async function notifyProvideGoods(outTradeNo) {
  return serverApi('/xpay/notify_provide_goods', { order_id: outTradeNo, env: cfg.env })
}

module.exports = { isConfigured, sessionKeyOf, buildPayParams, queryOrder, notifyProvideGoods, PRICE }
