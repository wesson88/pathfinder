import { ScrollView } from '@tarojs/components'
import { AGREEMENTS, AgreementKey } from '../../data/agreements'
import './index.scss'

/** 协议弹窗：首页页脚与支付页共用（09 §3） */
export default function AgreementModal({ agreementKey, onClose }: { agreementKey: AgreementKey | null; onClose: () => void }) {
  if (!agreementKey) return null
  const modal = AGREEMENTS[agreementKey]
  return (
    <view className='agree-mask' onClick={onClose}>
      <view className='agree-panel' onClick={(e) => e.stopPropagation()}>
        <view className='agree-title'>{modal.title}</view>
        <ScrollView scrollY className='agree-body'>{modal.body}</ScrollView>
        <view className='btn-primary agree-close' onClick={onClose}>我已阅读</view>
      </view>
    </view>
  )
}
