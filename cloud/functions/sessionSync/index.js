const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/** 答题进度云端同步（M3）：sessionId 为 docId 的 set 语义 = 天然 upsert，本地仍是主真相源 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { session } = event || {}
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }
  if (!session || !session.sessionId) return { ok: false, error: 'BAD_REQUEST' }

  try {
    await db.collection('sessions').doc(session.sessionId).set({
      data: {
        openid: OPENID,
        version: session.version,
        answers: session.answers || {},
        startedAt: session.startedAt,
        updatedAt: session.updatedAt,
        syncedAt: Date.now()
      }
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'SYNC_FAILED' }
  }
}
