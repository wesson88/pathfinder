import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { CLOUD_ENV, USE_MOCK } from './config'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    if (!USE_MOCK) {
      Taro.cloud.init({ env: CLOUD_ENV, traceUser: true })
    }
  })

  return children
}

export default App
