const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/** 我的报告列表（报告页云端兜底 / 记录页刷新用） */
exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }
  try {
    const q = await db.collection('reports')
      .where({ openid: OPENID })
      // 列表/展示不需要原始答卷，project 掉 answers 减少下行流量
      .field({ answers: false })
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()
    return { ok: true, reports: q.data }
  } catch (e) {
    return { ok: true, reports: [] }
  }
}
