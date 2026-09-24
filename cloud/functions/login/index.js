const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/** 登录：静默获取 openid（ADR：不用授权登录，M9） */
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }
  return { ok: true, openid: OPENID }
}
