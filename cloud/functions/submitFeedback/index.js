const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/** 反馈提交（M7）：「不太准」等用户声音落库，人工归类后驱动题库迭代 */
exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { content, contact, reportId } = event || {}
  if (!OPENID) return { ok: false, error: 'NO_OPENID' }
  if (!content || !String(content).trim()) return { ok: false, error: 'BAD_REQUEST' }

  try {
    await db.collection('feedback').add({
      data: {
        openid: OPENID,
        content: String(content).slice(0, 1000),
        contact: contact ? String(contact).slice(0, 100) : '',
        reportId: reportId ? String(reportId) : '',
        createdAt: Date.now()
      }
    })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'FEEDBACK_FAILED' }
  }
}
