import Taro from '@tarojs/taro'
import { callCloud } from './cloud'

/**
 * 埋点统一出口（M10 / D22）：轻量自建，fire-and-forget，失败静默，绝不阻塞用户操作。
 * 事件数据云端保留 12 个月（到期由 track 云函数惰性清理）。
 * mock 模式下为空操作（见 mock/index.ts）。
 */
export type TrackEvent =
  | 'home_view'
  | 'home_cta_click'
  | 'version_view'
  | 'version_select'
  | 'quiz_start'
  | 'quiz_submit'
  | 'quiz_submit_fail'
  | 'pay_view'
  | 'pay_agreement_open'
  | 'pay_success'
  | 'pay_fail'
  | 'report_view'
  | 'report_share'
  | 'record_view'
  | 'feedback_submit'
  | 'data_delete'

export function track(event: TrackEvent, props: Record<string, any> = {}) {
  const p: Record<string, any> = { ...props }
  try {
    if (Taro.getCurrentInstance().router?.path) {
      p.page = Taro.getCurrentInstance().router!.path
    }
  } catch { /* ignore */ }

  callCloud('track', { event, props: p, ts: Date.now() }).catch(() => {
    /* 埋点失败静默，不重试不阻塞 */
  })
}
