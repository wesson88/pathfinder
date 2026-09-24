import Taro from '@tarojs/taro'
import { currentPlatform } from '../config'
import { callCloud, isMockMode, sleep } from './cloud'

/** 小程序虚拟支付拉起参数（云函数 createOrder 签名后返回，04 §3） */
export interface VirtualPayParams {
  mode: 'short_series_goods'
  signData: string
  paySig: string
  signature: string
}

export interface CheckOrderResult {
  hasPaidUnused: boolean
  /** 已支付未核销超 48h（04 §2 铁律 4） */
  stalePaid?: boolean
}

// Taro 4.0.9 未收录 requestVirtualPayment 类型：直接走 wx 全局
declare const wx: {
  requestVirtualPayment(opts: VirtualPayParams & {
    success: () => void
    fail: (err: { errMsg?: string; errCode?: number }) => void
  }): void
}

/** 查单：失败抛错（绝不把查单失败当成「未支付」放行下单，04 §2 铁律 1） */
export const checkOrder = () => callCloud<CheckOrderResult>('checkOrder')

/** 支付到账双保险轮询（D14）：1.2s × 8 次 */
async function pollPaid(): Promise<boolean> {
  for (let i = 0; i < 8; i++) {
    await sleep(1200)
    try {
      const r = await checkOrder()
      if (r.hasPaidUnused) return true
    } catch { /* 继续轮询 */ }
  }
  return false
}

export type PayOutcome = 'paid' | 'pending' | 'canceled' | 'failed' | 'has_paid'

/**
 * VirtualPayProvider（全终端，D25）：wx.login 取 code → createOrder 签名 → wx.requestVirtualPayment → 轮询查单。
 * mock 模式下 createOrder 直接置已支付，payParams 为 null。
 */
export async function payPro(): Promise<PayOutcome> {
  const { code } = isMockMode() ? { code: 'mock' } : await Taro.login()
  let order: { outTradeNo: string; payParams: VirtualPayParams | null }
  try {
    order = await callCloud('createOrder', { code, platform: currentPlatform() })
  } catch (e) {
    // 服务端兜底防重复收款：已有已支付未使用订单
    if ((e as Error).message === 'HAS_PAID_UNUSED') return 'has_paid'
    throw e
  }
  if (!order.payParams) return (await pollPaid()) ? 'paid' : 'pending'

  const params = order.payParams
  const payResult = await new Promise<'ok' | 'canceled' | 'failed'>(resolve => {
    wx.requestVirtualPayment({
      ...params,
      success: () => resolve('ok'),
      fail: err => resolve(String(err?.errMsg || '').includes('cancel') ? 'canceled' : 'failed')
    })
  })
  // 取消/失败：订单留在 created，若实际已扣款，下次进支付页挂载查单即可恢复
  if (payResult !== 'ok') return payResult
  return (await pollPaid()) ? 'paid' : 'pending'
}
