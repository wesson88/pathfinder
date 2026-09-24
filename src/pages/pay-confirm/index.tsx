import { useState } from 'react'
import Taro from '@tarojs/taro'
import { PRICE_PRO_FEN, formatPrice } from '../../config'
import { AGREEMENTS, AGREEMENT_LINKS, AgreementKey, CHECKBOX_TEXT } from '../../data/agreements'
import { callCloud, isMockMode, sleep } from '../../utils/cloud'
import { track } from '../../utils/track'
import './index.scss'

/** 支付到账双保险轮询（D14）：1.2s × 8 次，仍未确认则提示稍后在记录页重试 */
async function pollPaid(): Promise<boolean> {
  for (let i = 0; i < 8; i++) {
    await sleep(1200)
    try {
      const r = await callCloud<{ hasPaidUnused: boolean }>('checkOrder')
      if (r.hasPaidUnused) return true
    } catch { /* 继续轮询 */ }
  }
  return false
}

export default function PayConfirm() {
  const [agreed, setAgreed] = useState(false)
  const [paying, setPaying] = useState(false)
  const [modalKey, setModalKey] = useState<AgreementKey | null>(null)

  const openAgreement = (key: AgreementKey) => {
    track('pay_agreement_open', { key })
    setModalKey(key)
  }

  const onPay = () => {
    if (paying) return
    if (!agreed) {
      Taro.showToast({ title: '请先阅读并勾选协议', icon: 'none' })
      return
    }
    setPaying(true)
    track('pay_view', { step: 'create' })

    callCloud<{ outTradeNo: string; payment: any }>('createOrder', { version: 'pro' })
      .then(r => {
        // mock 模式 payment 为 null，直接视为支付成功
        if (!r.payment) return pollPaid()
        return Taro.requestPayment({ ...r.payment })
          .then(() => pollPaid())
          .catch((err) => {
            // 用户取消或支付失败：订单留在 created（24h 惰性关单），可再次拉起
            const canceled = err && String(err.errMsg || '').includes('cancel')
            track('pay_fail', { canceled })
            Taro.showToast({ title: canceled ? '已取消支付' : '支付未完成', icon: 'none' })
            return 'canceled'
          })
      })
      .then(result => {
        if (result === 'canceled') return
        if (result === true) {
          track('pay_success', { mock: isMockMode() })
          Taro.redirectTo({ url: '/pages/quiz/index?version=pro' })
        } else {
          Taro.showModal({
            title: '支付结果确认中',
            content: '如已完成支付，请稍等几秒后重试进入；订单不会丢失',
            showCancel: false,
            success: () => Taro.redirectTo({ url: '/pages/version-select/index' })
          })
        }
      })
      .catch((e: Error) => {
        setPaying(false)
        Taro.showToast({ title: e?.message === 'CLOUD_ERROR' ? '下单失败，请重试' : '下单失败，请重试', icon: 'none' })
      })
  }

  const modal = modalKey ? AGREEMENTS[modalKey] : null

  return (
    <view className='pay'>
      <view className='card pay-card'>
        <view className='pay-name'>PRO 专业版</view>
        <view className='pay-price'>{formatPrice(PRICE_PRO_FEN)}</view>
        <view className='pay-meta'>12 题 · 约 4 分钟 · 一次解锁永久可测</view>
        <view className='pay-feats'>
          <view className='feat'>你的职业原型 + 匹配解读</view>
          <view className='feat'>最适配的职业方向 Top3</view>
          <view className='feat'>优势放大与盲区提醒</view>
        </view>
      </view>

      <view className='pay-agree' onClick={() => setAgreed(!agreed)}>
        <view className={`pay-checkbox ${agreed ? 'on' : ''}`} />
        <view className='pay-agree-text'>
          {CHECKBOX_TEXT}
          {AGREEMENT_LINKS.map(link => (
            <text key={link.key} className='pay-link' onClick={(e) => { e.stopPropagation(); openAgreement(link.key) }}>
              {link.label}
            </text>
          ))}
        </view>
      </view>

      <view className={`btn-primary pay-btn ${agreed ? '' : 'disabled'}`} onClick={onPay}>
        {paying ? '支付处理中…' : `支付 ${formatPrice(PRICE_PRO_FEN)} 并开始`}
      </view>
      <view className='pay-note'>由微信支付提供收款服务 · 未交卷可退款</view>

      {modal && (
        <view className='agree-mask' onClick={() => setModalKey(null)}>
          <view className='agree-panel' onClick={(e) => e.stopPropagation()}>
            <view className='agree-title'>{modal.title}</view>
            <scroll-view scrollY className='agree-body'>{modal.body}</scroll-view>
            <view className='btn-primary agree-close' onClick={() => setModalKey(null)}>我已阅读</view>
          </view>
        </view>
      )}
    </view>
  )
}
