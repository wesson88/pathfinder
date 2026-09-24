const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const RETENTION_MS = 12 * 30 * 24 * 3600 * 1000 // 12 个月（PIPL 最小必要，05 §4）
const GC_PROBABILITY = 0.1 // 惰性清理采样率：10% 的写入顺带删除过期事件，均摊成本

/**
 * 埋点落库（M10 / D22）：每条事件带 expireAt。
 * 到期清理由本函数惰性执行（盲审修复：原只写 expireAt、无任何执行方，保留期形同虚设）；
 * V2 事件量大后可改为定时触发器统一回收。
 */
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

    // 惰性清理过期事件（失败静默，不影响埋点应答）
    if (Math.random() < GC_PROBABILITY) {
      await db.collection('events')
        .where({ expireAt: _.lt(now) })
        .remove()
        .catch(() => { /* ignore */ })
    }

    return { ok: true }
  } catch (e) {
    // 埋点失败静默：前端本就不等待
    return { ok: false, error: 'TRACK_FAILED' }
  }
}
