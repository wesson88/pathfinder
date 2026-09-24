import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { isIosPayHidden, PRICE_PRO_FEN, formatPrice } from '../../config'
import { callCloud } from '../../utils/cloud'
import { getSession } from '../../utils/storage'
import { track } from '../../utils/track'
import { Version } from '../../data/types'
import './index.scss'

export default function VersionSelect() {
  // M4 §3 铁律：iOS 未开通虚拟支付时，PRO 卡片整体不展示（绝不出现「去安卓解锁」类引导）
  const proVisible = !isIosPayHidden()
  const [checking, setChecking] = useState(false)

  useDidShow(() => track('version_view'))

  const goQuiz = (version: Version) => {
    track('version_select', { version })
    Taro.redirectTo({ url: `/pages/quiz/index?version=${version}` })
  }

  const onFun = () => goQuiz('fun')

  /** PRO 入口：有进度→续答；有已支付未核销订单→直接答题（M4 铁律1 防重复收款）；否则去支付确认 */
  const onPro = () => {
    if (checking) return
    const session = getSession('pro')
    if (session) {
      goQuiz('pro')
      return
    }
    setChecking(true)
    callCloud<{ hasPaidUnused: boolean }>('checkOrder')
      .then(r => {
        if (r.hasPaidUnused) {
          goQuiz('pro')
        } else {
          track('version_select', { version: 'pro', to: 'pay' })
          Taro.navigateTo({ url: '/pages/pay-confirm/index' })
        }
      })
      .catch(() => {
        // 查单失败不堵路：去支付确认页重新走流程
        Taro.navigateTo({ url: '/pages/pay-confirm/index' })
      })
      .finally(() => setChecking(false))
  }

  return (
    <view className='vs'>
      <view className='vs-tip'>选一个版本，开始看见你的天赋</view>

      <view className='card vcard' onClick={onFun}>
        <view className='vcard-head'>
          <view className='vcard-name'>趣味版</view>
          <view className='vcard-price free'>免费</view>
        </view>
        <view className='vcard-meta'>6 题 · 约 2 分钟</view>
        <view className='vcard-feats'>
          <view className='feat'>你的五维天赋图谱</view>
          <view className='feat'>专属趣味称号与一句话洞察</view>
          <view className='feat'>即刻生成，可转发好友</view>
        </view>
        <view className='btn-primary vcard-btn'>开始趣味版</view>
      </view>

      {proVisible && (
        <view className='card vcard pro' onClick={onPro}>
          <view className='vcard-head'>
            <view className='vcard-name'>PRO 专业版</view>
            <view className='pro-badge'>PRO</view>
            <view className='vcard-price'>{formatPrice(PRICE_PRO_FEN)}</view>
          </view>
          <view className='vcard-meta'>12 题 · 约 4 分钟</view>
          <view className='vcard-feats'>
            <view className='feat'>含趣味版全部内容</view>
            <view className='feat'>你的职业原型 + 匹配解读</view>
            <view className='feat'>最适配的职业方向 Top3</view>
            <view className='feat'>优势放大与盲区提醒</view>
          </view>
          <view className='btn-primary vcard-btn'>{checking ? '查询中…' : '解锁 PRO 完整报告'}</view>
        </view>
      )}

      <view className='disclaimer vs-disclaimer'>测评结果仅供自我探索与职业启发，不构成专业诊断</view>
    </view>
  )
}
