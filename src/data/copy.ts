import { DimKey } from './types'

/**
 * 文案库：报告生成与界面文案集中配置（M6 文案规则）。
 * 红线（M9）：不出现「专业心理测评/最准/科学测算」等表述。
 */

/** 维度解释（雷达图点按浮层第一行，30 字左右；测的是倾向而非能力，02 §2） */
export const DIM_EXPLAIN: Record<DimKey, string> = {
  insight: '倾向先抓住复杂信息里的关键规律——别人看到现象，你更常看到结构。',
  creativity: '倾向寻找新想法、新角度——把「大家都这么做」变成「还能那样」。',
  action: '倾向尽快把想法推向现实——少纠结、多出手、用结果说话。',
  collab: '倾向与人配合、带动群体——让一加一大于二。',
  stability: '倾向持续、有秩序地推进——说到做到的确定性。'
}

/** 分段行为化描述（浮层第二行；分段按相对自身的雷达值；低分零负面词，用「待激活」框架） */
export const DIM_LEVEL: Record<DimKey, { high: string; mid: string; low: string }> = {
  insight: {
    high: '你常常第一个问「我们真正要解决的是什么」。',
    mid: '你习惯先弄懂再行动，判断有依据。',
    low: '直觉和体验是你的主要导航，这本身也是一种天赋。'
  },
  creativity: {
    high: '脑子里总冒出「换个玩法试试」的念头。',
    mid: '你在熟悉的框架里也能找到新鲜做法。',
    low: '你更信任被验证过的方式，稳定输出是你的风格。'
  },
  action: {
    high: '想到就干，你的待办清单很少过夜。',
    mid: '你节奏稳，决定之后就会动起来。',
    low: '你喜欢想清楚再走每一步，慢就是你的快。'
  },
  collab: {
    high: '有你在，团队的合作总是格外顺。',
    mid: '你能照顾好协作里的关键关系。',
    low: '你更享受独立深耕，用作品与人对话。'
  },
  stability: {
    high: '交给你的事，大家从来不用问第二遍。',
    mid: '你的可靠体现在关键节点从不掉链子。',
    low: '你更习惯随机应变，计划对你来说是参考而不是约束。'
  }
}

export type LevelName = 'high' | 'mid' | 'low'

/** v2 雷达相对自身（最强维恒为 95，恒在优势区）；v1 旧报告沿用同一阈值 */
export const levelOf = (score: number): LevelName => (score >= 80 ? 'high' : score >= 60 ? 'mid' : 'low')

export const LEVEL_LABEL: Record<LevelName, string> = {
  high: '优势区',
  mid: '稳定区',
  low: '待激活'
}

/** 首页文案 */
export const HOME_COPY = {
  title: ['找到让你', '闪闪发光的职业'],
  sub: '不是给你贴标签，而是帮你看见那些一直被忽略的天赋线索',
  cta: '开始探索我的天赋',
  ctaResume: (n: number, total: number) => `继续上次测试（第 ${n}/${total} 题）`,
  meta: '趣味版约 2 分钟起 · 隐私保护 · 即时报告',
  whyTitle: '为什么值得一测',
  why: [
    { name: '职业方向', desc: '找到更适配的舞台' },
    { name: '优势洞察', desc: '看见你的潜在能力' },
    { name: '成长建议', desc: '获取下一步行动提示' }
  ],
  disclaimer: '测评结果仅供自我探索与职业启发，不构成专业诊断'
}

/** 趣味版报告的 PRO 转化卡（D16；D26：CTA 说清是付费再做一次 PRO 测试，不是解锁当前报告） */
export const UPSELL_COPY = {
  title: '想看看你和哪些职业方向最配？',
  cta: '做一次 PRO 深度测试'
}

/** n 来自 result.careerFitHint（趣味版计分时静默计算，v2 全枚举 5~15） */
export const upsellDesc = (n: number) =>
  `你的画像与 ${n} 个职业方向较为适配——它们是谁？PRO 深度版 12 题，报告含职业原型、Top3 方向与成长建议`

/** PRO 付费文案（D26：每次付费生成 1 份 PRO 报告，永久查看；不得写「一次解锁永久可测」） */
export const PAY_COPY = {
  name: 'PRO 深度版',
  meta: '12 题 · 约 4 分钟 · 每次付费生成 1 份报告，永久查看',
  feats: ['你的职业原型与匹配解读', '适配的职业方向 Top3', '优势放大与盲区提醒'],
  note: '由微信小程序虚拟支付收款 · 生成报告前可申请退款'
}

/** 分享模板（D19 转发卡片；不带任何百分比，08 §2） */
export const SHARE_COPY = {
  pro: (name: string) => `我的天赋原型是「${name}」，来测测你的？`,
  fun: (title: string) => `我的趣味天赋是「${title}」，来测测你的？`,
  homeTitle: '天赋星球｜找到让你闪闪发光的职业'
}

/** 首页社交证明（D20）：口径是报告份数，不是人数（二轮盲审 X5）。「大家怎么说」评价区已下线（D30） */
export const statsText = (n: number) => `已生成 ${n} 份天赋报告`

/** 首次进入的隐私告知（PIPL 第 17 条：处理前告知；同意前不采集行为数据，09 §5） */
export const CONSENT_COPY = {
  title: '欢迎来到天赋星球',
  body: '为了生成你的报告，我们会处理你的微信标识、答卷与使用行为数据，不收集昵称、头像、手机号。详见',
  agree: '同意并继续'
}

/** 报告页反馈区（07 §2） */
export const FEEDBACK_COPY = {
  title: '这份报告像你吗？',
  good: '还挺准',
  bad: '不太准',
  placeholder: '选填：说说哪里像、哪里不像（200 字内）',
  submit: '提交反馈',
  thanks: '谢谢你的反馈，我们会用它改进题目'
}

/** 质量提示（03 §6）：标注不拦截、不羞辱 */
export const QC_NOTICE = '这次作答节奏较快，结果可能不太稳定——有空可以凭第一直觉再测一次'

/** 档位化展示：v2 结果自带档位；以下两个仅用于 v1 旧报告兼容（按旧百分比换算档位） */
export const legacyArchetypeTier = (match: number) => (match >= 80 ? '高度匹配' : '较为匹配')
export const legacyCareerTier = (percent: number) =>
  percent >= 80 ? '高度适配' : percent >= 65 ? '较为适配' : '值得关注'
export const MATCH_FOOTNOTE = '匹配度为题库内相对匹配度，非客观预测'
/** 雷达图说明：v2 雷达是相对自身的形状，不与他人比较 */
export const RADAR_NOTE = '雷达图展示的是你自己五个维度之间的相对倾向，不与他人比较'
