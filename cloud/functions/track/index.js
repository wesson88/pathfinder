const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const RETENTION_MS = 12 * 30 * 24 * 3600 * 1000 // 12 个月（PIPL 最小必要，05 §4）

/** 埋点落库（M10 / D22）：每条事件带 expireAt，到期清理由定期任务执行（V2 接入定时触发器） */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { event: name, props, ts } = event || {}
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }
  if (!name) return { ok: false, error: 'BAD_REQUEST' }

  const now = Date.now()
  try {
    await db.collection('events').add({
      data: {
        openid: OPENID,
        event: String(name).slice(0, 64),
        props: props || {},
        ts: ts || now,
        createdAt: now,
        expireAt: now + RETENTION_MS
      }
    })
    return { ok: true }
  } catch (e) {
    // 埋点失败静默：前端本就不等待
    return { ok: false, error: 'TRACK_FAILED' }
  }
}
