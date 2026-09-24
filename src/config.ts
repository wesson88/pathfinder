/**
 * 全局配置
 */
import Taro from '@tarojs/taro'

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

/**
 * 运行时第二道防线（二轮盲审技术 M6）：dev:weapp 产物默认 mock=true，若被误上传为体验版/正式版，
 * 构建期检查拦不住——按小程序运行环境再拦一次，体验版/正式版里 mock 态直接抛错。
 */
if (USE_MOCK) {
  let envVersion = 'develop'
  try {
    envVersion = Taro.getAccountInfoSync().miniProgram.envVersion
  } catch { /* 非小程序环境（如单测）忽略 */ }
  if (envVersion === 'release' || envVersion === 'trial') {
    throw new Error('[career-test] 体验版/正式版禁止运行 mock 构建产物')
  }
}

/**
 * PRO 展示价格（单位：分）。唯一事实源在云函数 xpay.PRICE（M4 §3），本常量仅作展示。
 * 全终端小程序虚拟支付（D25）：安卓/PC ¥0.99；iOS 走苹果档位制最低 ¥1。
 */
export const PRICE_PRO_FEN = 99
export const PRICE_PRO_IOS_FEN = 100

export const currentPlatform = () => {
  try {
    return Taro.getDeviceInfo().platform
  } catch {
    return 'unknown'
  }
}

/** 当前设备的 PRO 展示价 */
export const proPriceFen = () => (currentPlatform() === 'ios' ? PRICE_PRO_IOS_FEN : PRICE_PRO_FEN)

export const formatPrice = (fen: number) => `¥${(fen / 100).toFixed(2)}`
