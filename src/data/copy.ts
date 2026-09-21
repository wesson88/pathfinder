import { DimKey } from './types'

/**
 * 文案库：报告生成与界面文案集中配置（M6 文案规则）。
 * 红线（M9）：不出现「专业心理测评/最准/科学测算」等表述。
 */

/** 维度解释（雷达图点按浮层第一行，30 字左右） */
export const DIM_EXPLAIN: Record<DimKey, string> = {
  insight: '从复杂信息里抓住关键规律的能力——别人看到现象，你看到结构。',
  creativity: '产生新想法、新角度的能力——把「大家都这么做」变成「还能那样」。',
  action: '把想法推向现实的推进力——少纠结、多出手、用结果说话。',
  collab: '与人配合、撬动群体的能力——让一加一大于二。',
  stability: '持续、可靠、有秩序的产出能力——说到做到的确定性。'
}

/** 分数段行为化描述（浮层第二行；低分零负面词，用「待激活」框架） */
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
    low: '灵活应变是你的强项，计划赶不上你的变化。'
  }
}

export type LevelName = 'high' | 'mid' | 'low'

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

/** 趣味版报告的 PRO 转化卡（D16；盲审修订：不点名数量钩子替代卖点罗列） */
export const UPSELL_COPY = {
  title: '想看看你和哪些职业方向最配？',
  cta: '解锁 PRO 完整报告'
}

/** n 来自 result.careerFitHint（趣味版计分时静默计算） */
export const upsellDesc = (n: number) =>
  `你的画像已与 ${n} 个职业方向较为适配——它们是谁？PRO 报告还包含你的职业原型与成长行动建议`

/** 分享模板（D19 转发卡片） */
export const SHARE_COPY = {
  pro: (name: string, fit: number) => `我的天赋原型是「${name}」，职业适配 ${fit}%`,
  fun: (title: string) => `我的趣味天赋是「${title}」，来测测你的？`,
  homeTitle: '天赋星球｜找到让你闪闪发光的职业'
}

/** 「大家怎么说」（D18：内测体验官标注） */
export const TESTIMONIALS = [
  { who: '产品经理 · 内测体验官', text: '原来我一直擅长的事情，真的可以成为职业方向。' },
  { who: 'HR · 内测体验官', text: '雷达图和我的自我认知几乎重合，建议栏也很可执行。' },
  { who: '设计师 · 内测体验官', text: '几分钟做完，结果比想象中细致，转给了整个组。' }
]

/** 档位化展示（裁决单 C2 防伪精度）：内部数值仅排序，对外一律档位 + 脚注 */
export const archetypeTier = (match: number) => (match >= 80 ? '高度匹配' : '较为匹配')
export const careerTier = (percent: number) =>
  percent >= 80 ? '高度适配' : percent >= 65 ? '较为适配' : '值得关注'
export const MATCH_FOOTNOTE = '匹配度为题库内相对匹配度，非客观预测'
