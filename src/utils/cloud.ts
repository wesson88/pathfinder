import Taro from '@tarojs/taro'
import { USE_MOCK } from '../config'
import { mockCall } from '../mock'

/**
 * 云函数调用统一封装。
 * 返回值约定：云函数返回 { ok: boolean, ... }，ok=false 时抛错（error 透传为 message）。
 */
export async function callCloud<T = any>(
  name: string,
  data?: Record<string, any>
): Promise<T> {
  // mock 与真实云端同一套 ok:false → 抛错语义（原 mock 分支直接返回，错误码永远到不了调用方）
  const result = (USE_MOCK
    ? await mockCall(name, data || {})
    : (await Taro.cloud.callFunction({ name, data: data || {} })).result) as Record<string, any>
  if (!result || result.ok === false) {
    throw new Error((result && result.error) || 'CLOUD_ERROR')
  }
  return result as T
}

export const isMockMode = () => USE_MOCK

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
