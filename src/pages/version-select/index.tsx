import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { formatPrice, proPriceFen } from '../../config'
import { PAY_COPY } from '../../data/copy'
import { checkOrder } from '../../utils/pay'
import { track } from '../../utils/track'
import { Version } from '../../data/types'
import './index.scss'

export default function VersionSelect() {
  const [checking, setChecking] = useState(false)

  useDidShow(() => track('version_select_view'))

  const goQuiz = (version: Version) => {
    track('select_version', { version })
    Taro.redirectTo({ url: `/pages/quiz/index?version=${version}` })
  }

  const onFun = () => goQuiz('fun')

  /**
   * PRO 入口（全终端，D25）：先查单——有已支付未使用订单 → 直接答题（续答或新答）；否则去支付页。
   * 查单失败提示重试，不放行下单（04 §2 铁律 1）。
   */
  const onPro = () => {
    if (checking) return
    setChecking(true)
    checkOrder()
      .then(r => {
        if (!r.hasPaidUnused) {
          Taro.navigateTo({ url: '/pages/pay-confirm/index' })
          return
        }
        if (r.stalePaid) {
          // 04 §2 铁律 4：已支付超 48h 未使用
          Taro.showModal({
            title: '你有一笔未使用的 PRO',
            content: '你已付费但还没有生成报告，可以直接开始作答；如不想使用，可在首页「联系客服」申请退款。',
            confirmText: '开始作答',
            success: res => res.confirm && goQuiz('pro')
          })
          return
        }
        goQuiz('pro')
      })
      .catch(() => Taro.showToast({ title: '订单查询失败，请稍后重试', icon: 'none' }))
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
          <view className='feat'>你的五维倾向图谱</view>
          <view className='feat'>专属趣味称号与一句话洞察</view>
          <view className='feat'>即刻生成，可转发好友</view>
        </view>
        <view className='btn-primary vcard-btn'>开始趣味版</view>
      </view>

      <view className='card vcard pro' onClick={onPro}>
        <view className='vcard-head'>
          <view className='vcard-name'>{PAY_COPY.name}</view>
          <view className='pro-badge'>PRO</view>
          <view className='vcard-price'>{formatPrice(proPriceFen())}</view>
        </view>
        <view className='vcard-meta'>{PAY_COPY.meta}</view>
        <view className='vcard-feats'>
          {PAY_COPY.feats.map(f => (
            <view key={f} className='feat'>{f}</view>
          ))}
        </view>
        <view className='btn-primary vcard-btn'>{checking ? '查询中…' : '开始 PRO 深度测试'}</view>
      </view>

      <view className='disclaimer vs-disclaimer'>测评结果仅供自我探索与职业启发，不构成专业诊断</view>
    </view>
  )
}
