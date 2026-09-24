const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const MAX_LEN = 200

/**
 * 报告页反馈（M7，07 §2）：还挺准 / 不太准 + 选填感受。
 * - 文字入库前过 msgSecCheck（UGC 合规硬要求；config.json 声明 openapi 权限）
 * - 不收集联系方式（需要回复的诉求走客服会话）
 * - 每份报告限反馈一次：docId = reportId，且报告须归属本人
 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { reportId, accuracy, content } = event || {}
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }
  if (typeof reportId !== 'string' || !reportId || !['good', 'bad'].includes(accuracy)) {
    return { ok: false, error: 'BAD_REQUEST' }
  }
  const text = typeof content === 'string' ? content.trim().slice(0, MAX_LEN) : ''

  const report = await db.collection('reports').doc(reportId).get()
    .then(d => (Array.isArray(d.data) ? d.data[0] : d.data))
    .catch(() => null)
  if (!report || report.openid !== OPENID) return { ok: false, error: 'REPORT_NOT_FOUND' }

  if (text) {
    try {
      const r = await cloud.openapi.security.msgSecCheck({ openid: OPENID, scene: 2, version: 2, content: text })
      if (!r || !r.result || r.result.suggest !== 'pass') return { ok: false, error: 'CONTENT_RISKY' }
    } catch (e) {
      // 检测服务异常时不放行文字，只保留快捷反馈
      return { ok: false, error: 'CONTENT_CHECK_FAILED' }
    }
  }

  const exists = await db.collection('feedback').doc(reportId).get().then(() => true).catch(() => false)
  if (exists) return { ok: true, duplicate: true }
  try {
    await db.collection('feedback').add({
      data: { _id: reportId, openid: OPENID, reportId, accuracy, content: text, createdAt: Date.now() }
    })
    return { ok: true }
  } catch (e) {
    // 只有「已存在」算重复；其余写入失败如实返回（三轮盲审技术 L6）
    return { ok: false, error: 'FEEDBACK_FAILED' }
  }
}
