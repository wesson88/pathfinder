const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/** 登录：静默识别（ADR：不用授权登录，M9）。openid 只在云端使用，不回传前端（09 §5，二轮盲审合规 L3） */
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }
  return { ok: true }
}
