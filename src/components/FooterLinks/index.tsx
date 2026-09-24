import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Button } from '@tarojs/components'
import { AGREEMENT_LINKS, AgreementKey } from '../../data/agreements'
import { analyticsToggleText } from '../../data/copy'
import { hasConsent, setConsent } from '../../utils/storage'
import { track } from '../../utils/track'
import AgreementModal from '../AgreementModal'
import './index.scss'

/**
 * 页脚：三份协议常驻入口 + 联系客服（09 §3/§6，二轮盲审合规 H3/H4）。
 * 客服走微信客服会话 open-type="contact"，承接退款与其他个人信息请求。
 */
export default function FooterLinks({ source }: { source: string }) {
  const [key, setKey] = useState<AgreementKey | null>(null)
  const [analyticsOn, setAnalyticsOn] = useState(hasConsent())
  const toggleAnalytics = () => {
    const next = !analyticsOn
    setConsent(next ? 'granted' : 'declined')
    setAnalyticsOn(next)
    Taro.showToast({ title: next ? '已开启使用分析' : '已关闭，不再采集使用分析', icon: 'none' })
  }
  return (
    <view className='footer-links'>
      <view className='footer-agreements'>
        {AGREEMENT_LINKS.map(link => (
          <text key={link.key} className='footer-link' onClick={() => setKey(link.key)}>{link.label}</text>
        ))}
      </view>
      <Button className='footer-contact' openType='contact' onClick={() => track('contact_tap', { source })}>
        联系客服
      </Button>
      <view className='footer-analytics' onClick={toggleAnalytics}>{analyticsToggleText(analyticsOn)}</view>
      <AgreementModal agreementKey={key} onClose={() => setKey(null)} />
    </view>
  )
}
