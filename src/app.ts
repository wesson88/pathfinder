import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { CLOUD_ENV, USE_MOCK } from './config'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    if (!USE_MOCK) {
      // traceUser 关闭：同意使用分析之前不在平台侧记录访问用户（三轮盲审合规 L2）
      Taro.cloud.init({ env: CLOUD_ENV, traceUser: false })
    }
  })

  return children
}

export default App
