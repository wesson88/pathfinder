import { USE_MOCK } from '../config'
import {
  getCachedReports,
  getMockProUnlocked,
  replaceCachedReports,
  setMockProUnlocked
} from '../utils/storage'
import { ReportItem } from '../data/types'

/**
 * mock 模式：构建期 TARO_APP_MOCK=true 时启用（D4 修订）。
 * 模拟全部云函数行为（含 PRO 解锁态），无云端即可跑通全流程。
 */
export async function mockCall(name: string, data: Record<string, any>): Promise<any> {
  switch (name) {
    case 'login':
      return { ok: true }

    case 'getStats':
      // D20 修订：只返回真实报告计数，虚构基数已废弃
      return { ok: true, reportsTotal: getCachedReports().length }

    case 'submitTest': {
      if (data.version === 'pro' && !getMockProUnlocked()) {
        return { ok: false, error: 'NO_PAID_ORDER' }
      }
      if (data.version === 'pro') setMockProUnlocked(false)
      const report: ReportItem = {
        _id: data.sessionId || `mock-${Date.now()}`, // docId=sessionId，与云端幂等语义一致（03 §5）
        version: data.version,
        result: data.result,
        sessionId: data.sessionId,
        answers: data.answers,
        createdAt: new Date().toISOString()
      }
      replaceCachedReports([report, ...getCachedReports()])
      return { ok: true, reportId: report._id }
    }

    case 'getReports':
      return {
        ok: true,
        reports: data.id ? getCachedReports().filter(r => r._id === data.id) : getCachedReports(),
        hasMore: false
      }

    case 'createOrder':
      // 与云端一致的防重复收款：已有已支付未使用 → 拒绝下单
      if (getMockProUnlocked()) return { ok: false, error: 'HAS_PAID_UNUSED' }
      // 模拟支付：直接置为已支付，payParams 为 null（跳过 wx.requestVirtualPayment）
      setMockProUnlocked(true)
      return { ok: true, outTradeNo: `mock-${Date.now()}`, payParams: null }

    case 'checkOrder':
      return { ok: true, hasPaidUnused: getMockProUnlocked(), stalePaid: false }

    case 'submitFeedback':
      if (!data.reportId || !['good', 'bad'].includes(data.accuracy)) return { ok: false, error: 'BAD_REQUEST' }
      return { ok: true }

    case 'track':
      // M10：mock 模式埋点为空操作
      return { ok: true }

    case 'deleteMyData':
      return { ok: true }

    default:
      return { ok: false, error: 'UNKNOWN_FUNCTION' }
  }
}

export const isMock = () => USE_MOCK
