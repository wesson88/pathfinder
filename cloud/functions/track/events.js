// ⚠ 自动生成：源文件 cloud/shared/events.js，由 npm run sync:cloud 复制，勿手改
/**
 * 埋点事件白名单（10 §3 字典）——云端唯一源，由 npm run sync:cloud 复制进 track 云函数。
 * 与前端 src/utils/track.ts 的 TrackEvent 联合类型必须一致（npm run check:cloud 校验）。
 */
const EVENTS = [
  'home_view',
  'home_cta_tap',
  'version_select_view',
  'select_version',
  'quiz_start',
  'quiz_answer',
  'quiz_abandon',
  'quiz_submit',
  'report_view',
  'radar_dim_tap',
  'report_feedback',
  'upsell_tap',
  'pay_view',
  'pay_success',
  'pay_fail',
  'share_tap',
  'retake_tap',
  'contact_tap',
  'data_clear'
]

/** 不写 openid 的事件 */
const ANONYMOUS_EVENTS = ['data_clear']

module.exports = { EVENTS, ANONYMOUS_EVENTS }
