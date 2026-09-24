import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { formatPrice, proPriceFen } from '../../config'
import AgreementModal from '../../components/AgreementModal'
import { AGREEMENT_LINKS, AgreementKey, CHECKBOX_TEXT } from '../../data/agreements'
import { PAY_COPY } from '../../data/copy'
import { checkOrder, payPro } from '../../utils/pay'
import { track } from '../../utils/track'
import './index.scss'

const goQuiz = () => Taro.redirectTo({ url: '/pages/quiz/index?version=pro' })

export default function PayConfirm() {
  const [agreed, setAgreed] = useState(false)
  const [paying, setPaying] = useState(false)
  // 挂载即查单（04 §2 铁律 1）：任何入口进来都先确认没有已支付未使用的订单
  const [checking, setChecking] = useState(true)
  const [checkFailed, setCheckFailed] = useState(false)
  const [modalKey, setModalKey] = useState<AgreementKey | null>(null)
  const price = formatPrice(proPriceFen())

  const runCheck = () => {
    setChecking(true)
    setCheckFailed(false)
    checkOrder()
      .then(r => {
        if (r.hasPaidUnused) {
          Taro.showToast({ title: '你有一笔已支付未使用的 PRO，直接开始', icon: 'none' })
          goQuiz()
        }
      })
      .catch(() => setCheckFailed(true))
      .finally(() => setChecking(false))
  }

  useEffect(() => {
    track('pay_view')
    runCheck()
  }, [])

  const openAgreement = (key: AgreementKey) => setModalKey(key)

  const onPay = () => {
    if (paying || checking) return
    if (checkFailed) {
      runCheck()
      return
    }
    if (!agreed) {
      Taro.showToast({ title: '请先阅读并勾选协议', icon: 'none' })
      return
    }
    setPaying(true)
    payPro()
      .then(outcome => {
        if (outcome === 'paid' || outcome === 'has_paid') {
          track('pay_success')
          goQuiz()
          return
        }
        setPaying(false)
        if (outcome === 'canceled' || outcome === 'failed') {
          track('pay_fail', { reason: outcome })
          Taro.showToast({ title: outcome === 'canceled' ? '已取消支付' : '支付未完成', icon: 'none' })
          return
        }
        Taro.showModal({
          title: '支付结果确认中',
          content: '如已完成支付，请稍等几秒后重新进入；订单不会丢失，也不会重复收费',
          showCancel: false,
          success: () => Taro.navigateBack().catch(() => Taro.switchTab({ url: '/pages/home/index' }))
        })
      })
      .catch((e: Error) => {
        setPaying(false)
        const checking = e && e.message === 'CHECK_FAILED'
        track('pay_fail', { reason: checking ? 'check' : 'order' })
        Taro.showToast({ title: checking ? '正在确认上一笔订单，请稍后再试' : '下单失败，请重试', icon: 'none' })
      })
  }

  const btnText = checking
    ? '正在确认订单…'
    : checkFailed
      ? '订单查询失败，点此重试'
      : paying
        ? '支付处理中…'
        : `支付 ${price}，生成我的 PRO 报告`

  return (
    <view className='pay'>
      <view className='card pay-card'>
        <view className='pay-name'>{PAY_COPY.name}</view>
        <view className='pay-price'>{price}</view>
        <view className='pay-meta'>{PAY_COPY.meta}</view>
        <view className='pay-feats'>
          {PAY_COPY.feats.map(f => (
            <view key={f} className='feat'>{f}</view>
          ))}
        </view>
      </view>

      <view className='pay-agree' onClick={() => setAgreed(!agreed)}>
        <view className={`pay-checkbox ${agreed ? 'on' : ''}`} />
        <view className='pay-agree-text'>
          {CHECKBOX_TEXT.prefix}
          {AGREEMENT_LINKS.map(link => (
            <text key={link.key} className='pay-link' onClick={(e) => { e.stopPropagation(); openAgreement(link.key) }}>
              {link.label}
            </text>
          ))}
          {CHECKBOX_TEXT.suffix}
        </view>
      </view>

      <view className={`btn-primary pay-btn ${agreed && !checking ? '' : 'disabled'}`} onClick={onPay}>
        {btnText}
      </view>
      <view className='pay-note'>{PAY_COPY.note}</view>

      <AgreementModal agreementKey={modalKey} onClose={() => setModalKey(null)} />
    </view>
  )
}
