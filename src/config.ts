/**
 * 全局配置
 */

/** 云开发环境 ID：开通云开发后，从「云开发控制台 → 设置 → 环境ID」复制到这里 */
export const CLOUD_ENV = ''

/**
 * mock 开关（D4 盲审修订）：仅由构建期环境变量 TARO_APP_MOCK 显式注入
 * （在 config/index.* 的 defineConstants 中定义，dev 默认 'true'、build 默认 'false'），
 * 不做任何运行时推断。生产构建 + mock 态直接抛错，
 * 杜绝「忘配环境变量 = 整包 mock 上线、全员免费解锁」。
 */
export const USE_MOCK = process.env.TARO_APP_MOCK === 'true'

if (USE_MOCK && process.env.NODE_ENV === 'production') {
  throw new Error('[career-test] 生产构建禁止包含 mock：请移除 TARO_APP_MOCK 后重新构建')
}

/** PRO 价格（单位：分）。唯一事实源在云函数 createOrder 内硬编码，本常量仅作展示（M4 §5） */
export const PRICE_PRO_FEN = 99

/** iOS 苹果内购档位价：IAP 无 ¥0.99 档，最低 ¥1（M4 §3），以后台档位配置为准 */
export const PRICE_PRO_IOS_FEN = 100

/** iOS 虚拟支付模式：'hidden' = 未开通 IAP，PRO 卡片在 iOS 整体不展示；'iap' = 已开通（M4 §3） */
export const PAY_IOS_MODE: 'hidden' | 'iap' = 'hidden'

export const formatPrice = (fen: number) => `¥${(fen / 100).toFixed(2)}`
