import { currentPlatform } from '../config'
import { BANK_VERSION } from './scoring'
import { callCloud } from './cloud'
import { hasConsent } from './storage'

/**
 * 埋点统一出口（M10 / D22 / D29）：轻量自建，fire-and-forget，失败静默，绝不阻塞用户操作。
 * 事件名与参数以项目记录《10-模块设计-埋点与数据分析》§3 字典为唯一权威；
 * 云端 track 云函数持同一白名单（cloud/shared/events.js，npm run check:cloud 校验两边一致）。
 */
export type TrackEvent =
  | 'home_view'
  | 'home_cta_tap'
  | 'version_select_view'
  | 'select_version'
  | 'quiz_start'
  | 'quiz_answer'
  | 'quiz_abandon'
  | 'quiz_submit'
  | 'report_view'
  | 'radar_dim_tap'
  | 'report_feedback'
  | 'upsell_tap'
  | 'pay_view'
  | 'pay_success'
  | 'pay_fail'
  | 'share_tap'
  | 'retake_tap'
  | 'contact_tap'
  | 'data_clear'

const MAX_PARAMS_BYTES = 1024

export function track(event: TrackEvent, params: Record<string, string | number | boolean | undefined> = {}) {
  // 知情先于采集（09 §5）：用户同意隐私告知前不上报任何行为数据
  if (!hasConsent()) return
  const clean: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(params)) if (v !== undefined) clean[k] = v
  if (JSON.stringify(clean).length > MAX_PARAMS_BYTES) return

  callCloud('track', {
    event,
    params: clean,
    platform: currentPlatform(),
    bankVersion: BANK_VERSION
  }).catch(() => {
    /* 埋点失败静默，不重试不阻塞 */
  })
}
