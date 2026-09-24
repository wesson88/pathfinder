import { Archetype, DimKey, FunTitle } from './types'

export const DIM_ORDER: DimKey[] = ['insight', 'creativity', 'action', 'collab', 'stability']

export const DIM_META: Record<DimKey, { label: string }> = {
  insight: { label: '洞察力' },
  creativity: { label: '创造力' },
  action: { label: '行动力' },
  collab: { label: '协作力' },
  stability: { label: '稳定性' }
}

/** 10 个职业原型（key 为两维度 key 字典序拼接；coreDims 决定理想画像向量，计分 v2 用去均值余弦匹配，02 §5） */
export const ARCHETYPES: Record<string, Archetype> = {
  'creativity+insight': {
    name: '洞察型策划者',
    slogan: '看见规律，也看见可能',
    strength: '你更常先看清问题本质，也倾向把模糊想法转化为可沟通的方向',
    coreDims: ['insight', 'creativity'],
    advice: {
      amplify: '在工作中主动争取「定义问题」的机会，把洞察沉淀为可复用的方法。',
      blindSpot: '避免因追求更优解而延迟行动，用小步验证替代反复推演。'
    }
  },
  'action+insight': {
    name: '敏锐型破局者',
    slogan: '在混沌中快速找到切入口',
    strength: '你往往更倾向于快速判断并动手验证，行动就是你最好的思考方式',
    coreDims: ['insight', 'action'],
    advice: {
      amplify: '给自己设定「先完成再完美」的最小交付标准，让判断更快落地。',
      blindSpot: '速度是你的优势，但记得留出复盘时间，避免用战术勤奋替代战略思考。'
    }
  },
  'collab+insight': {
    name: '共创型智囊',
    slogan: '把不同的声音整合成答案',
    strength: '你往往更倾向于倾听与连接，能把不同人的想法整合成清晰的方案',
    coreDims: ['insight', 'collab'],
    advice: {
      amplify: '把你「整合不同观点」的能力产品化，比如沉淀成方法论文档或内部分享。',
      blindSpot: '别急着吸收所有人的意见，先亮出自己的判断——你的观点本身很有价值。'
    }
  },
  'insight+stability': {
    name: '稳健型分析者',
    slogan: '在不确定中建立秩序',
    strength: '你往往更倾向于在不确定中建立秩序，给出可靠的判断依据',
    coreDims: ['insight', 'stability'],
    advice: {
      amplify: '主动把分析结论翻译成行动建议，让专业判断真正影响决策。',
      blindSpot: '警惕过度求证，70% 把握时就可以先行动、边走边修正。'
    }
  },
  'action+creativity': {
    name: '开创型探索者',
    slogan: '天生适合从 0 到 1',
    strength: '你往往更倾向于把灵感快速变成现实，新事物对你有天然的吸引力',
    coreDims: ['creativity', 'action'],
    advice: {
      amplify: '为你的创意配一个最小验证节奏，让灵感快速获得真实反馈。',
      blindSpot: '从 0 到 1 之后的事务性打磨容易让你失去兴趣，找互补伙伴接管运营期。'
    }
  },
  'collab+creativity': {
    name: '灵感型共创者',
    slogan: '让协作充满新意',
    strength: '你往往更倾向于激发团队的想象力，让一起做事变得有趣且有产出',
    coreDims: ['creativity', 'collab'],
    advice: {
      amplify: '把你激发他人的能力用在关键场合，比如主持头脑风暴和创意评审。',
      blindSpot: '注意收敛：创意发散之后要有人拍板收口，那个人可以是你。'
    }
  },
  'creativity+stability': {
    name: '匠心型设计者',
    slogan: '既新颖，又可靠',
    strength: '你往往更倾向于打磨细节，让想法既保有新意又经得起推敲',
    coreDims: ['creativity', 'stability'],
    advice: {
      amplify: '把你的审美与标准沉淀成规范和组件，影响力会放大数倍。',
      blindSpot: '完美是好的归宿，但不是好的起点——先交付，再迭代。'
    }
  },
  'action+collab': {
    name: '推动型连接者',
    slogan: '让一群人把事情做成',
    strength: '你往往更倾向于带动节奏、连接资源，是团队里天生的发动机',
    coreDims: ['action', 'collab'],
    advice: {
      amplify: '你推进事情时天然带人，试试主动承担更多跨团队协调的角色。',
      blindSpot: '别把所有事都扛在自己身上，学会借力与授权。'
    }
  },
  'action+stability': {
    name: '自律型实干家',
    slogan: '说到做到的确定性',
    strength: '你往往更倾向于持续稳定地产出结果，是可以托付重要事情的人',
    coreDims: ['action', 'stability'],
    advice: {
      amplify: '把你的执行方法论模板化，让团队复制你的确定性。',
      blindSpot: '定期抬头看方向，避免在错误的路上越跑越快。'
    }
  },
  'collab+stability': {
    name: '守护型支持者',
    slogan: '值得信赖的后盾',
    strength: '你往往更倾向于照顾团队与流程，让身边的人安心、让事情有序',
    coreDims: ['collab', 'stability'],
    advice: {
      amplify: '把你维护秩序与信任的能力显性化，比如主导一次流程优化项目。',
      blindSpot: '你的温和容易被低估，主动表达自己的需求与边界。'
    }
  }
}

/** top1 维度 → 趣味称号 */
export const FUN_TITLES: Record<DimKey, FunTitle> = {
  insight: { title: '行走的洞察机', line: '你总能在细节里看见别人忽略的规律' },
  creativity: { title: '点子永动机', line: '你的脑袋里永远装着下一个新想法' },
  action: { title: '行动派先锋', line: '想到就干，是你的超能力' },
  collab: { title: '团队小太阳', line: '有你在，合作就有了温度' },
  stability: { title: '靠谱担当', line: '交给你的事，大家从来不担心' }
}

/** 原型映射 key：两个维度 key 字典序拼接 */
export const archetypeKey = (a: DimKey, b: DimKey) => [a, b].sort().join('+')
