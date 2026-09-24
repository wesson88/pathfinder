const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const PAGE = 20

/**
 * 我的报告（报告页云端兜底 / 记录页刷新）：
 * - 传 id：按 docId 精确取一份（须归属本人）——报告页兜底不再受列表条数限制（二轮盲审技术 L4）
 * - 不传 id：分页列表，skip 翻页
 * 均不返回原始答卷（answers）。
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { id, skip } = event || {}
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }
  if (typeof id === 'string' && id) {
    try {
      const d = await db.collection('reports').doc(id).field({ answers: false }).get()
      const r = Array.isArray(d.data) ? d.data[0] : d.data
      return { ok: true, reports: r && r.openid === OPENID ? [r] : [] }
    } catch (e) {
      // doc 不存在会抛错：按「无」处理
      return { ok: true, reports: [] }
    }
  }
  try {
    const q = await db.collection('reports')
      .where({ openid: OPENID })
      .field({ answers: false })
      .orderBy('createdAt', 'desc')
      .skip(Math.max(0, Number(skip) || 0))
      .limit(PAGE)
      .get()
    return { ok: true, reports: q.data, hasMore: q.data.length === PAGE }
  } catch (e) {
    return { ok: false, error: 'QUERY_FAILED' }
  }
}
