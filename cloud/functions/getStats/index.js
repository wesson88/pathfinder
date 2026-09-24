const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/** 首页社交证明计数（D20 修订）：只返回真实报告计数，counters/reports 由 submitTest 原子递增 */
exports.main = async () => {
  try {
    const r = await db.collection('counters').doc('reports').get()
    return { ok: true, reportsTotal: (r.data && r.data.reportsTotal) || 0 }
  } catch (e) {
    // 计数文档尚不存在 = 还没有人交卷
    return { ok: true, reportsTotal: 0 }
  }
}
