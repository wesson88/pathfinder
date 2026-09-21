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
  if (USE_MOCK) {
    return mockCall(name, data || {}) as T
  }

  const res = await Taro.cloud.callFunction({ name, data: data || {} })
  const result = res.result as Record<string, any>
  if (!result || result.ok === false) {
    throw new Error((result && result.error) || 'CLOUD_ERROR')
  }
  return result as T
}

export const isMockMode = () => USE_MOCK

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
