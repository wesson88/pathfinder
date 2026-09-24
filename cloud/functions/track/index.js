const cloud = require('wx-server-sdk')
const { EVENTS, ANONYMOUS_EVENTS } = require('./events')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const RETENTION_MS = 365 * 24 * 3600 * 1000 // 12 个月（10 §4）
const GC_PROBABILITY = 0.05 // 惰性清理采样率：5% 的写入顺带删除过期事件（依赖 expireAt 索引）
const MAX_PARAMS_BYTES = 1024

/**
 * 埋点落库（M10 / D22 / D29）：
 * - 事件名白名单（10 §3 字典）与 params 大小上限二次校验，防刷写存储（二轮盲审技术 L1）
 * - 结构 { openid, event, params, platform, bankVersion, createdAt, expireAt }
 * - data_clear 等匿名事件不写 openid（删除数据后不再留下带标识的记录，05 §4）
 * - 过期明细惰性清理
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { event: name, params, platform, bankVersion } = event || {}
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }
  if (!EVENTS.includes(name)) return { ok: false, error: 'UNKNOWN_EVENT' }
  const p = params && typeof params === 'object' && !Array.isArray(params) ? params : {}
  if (JSON.stringify(p).length > MAX_PARAMS_BYTES) return { ok: false, error: 'PARAMS_TOO_LARGE' }

  const now = Date.now()
  try {
    await db.collection('events').add({
      data: {
        openid: ANONYMOUS_EVENTS.includes(name) ? '' : OPENID,
        event: name,
        params: p,
        platform: String(platform || '').slice(0, 16),
        bankVersion: String(bankVersion || '').slice(0, 16),
        createdAt: now,
        expireAt: now + RETENTION_MS
      }
    })

    if (Math.random() < GC_PROBABILITY) {
      await db.collection('events').where({ expireAt: _.lt(now) }).remove().catch(() => { /* ignore */ })
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'TRACK_FAILED' }
  }
}
