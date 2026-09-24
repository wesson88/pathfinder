/** 测试版本：趣味版（免费）/ PRO 深度版（付费，每次付费生成 1 份报告） */
export type Version = 'fun' | 'pro'

/** 五个倾向维度（测的是偏好倾向，不是能力，02 §2） */
export type DimKey = 'insight' | 'creativity' | 'action' | 'collab' | 'stability'

export type DimScores = Record<DimKey, number>

export interface QuestionOption {
  key: string
  text: string
  /** 选择该项后各维度获得的分值（单维映射。PRO：四选一 3 分 / 迫选胜方 2 分；趣味版：2 分） */
  scores: Partial<DimScores>
}

export interface Question {
  id: string
  /** single: 情境四选一（默认）；forced: 迫选二选一 */
  type?: 'single' | 'forced'
  /** PRO 版题目分类，如「职业行为偏好」 */
  category?: string
  /** 作答提示（仅迫选题使用；不得暴露测量意图，02 §4） */
  hint?: string
  question: string
  options: QuestionOption[]
}

export interface CareerMatch {
  name: string
  reason: string
  /** 计分 v2：适配档位（高度适配 / 较为适配 / 值得关注） */
  tier?: string
  /** 计分 v1 遗留：旧报告的内部百分比，仅用于兼容展示档位 */
  percent?: number
}

/** PRO 版职业原型（五维画像与理想画像相似度匹配） */
export interface Archetype {
  name: string
  slogan: string
  strength: string
  /** [第一主维, 第二主维]，决定理想画像向量 */
  coreDims: [DimKey, DimKey]
  advice: { amplify: string; blindSpot: string }
}

/** 趣味版称号（由 top1 维度映射） */
export interface FunTitle {
  title: string
  line: string
}

/** 计分产物，云端与本地缓存统一结构 */
export interface TestResult {
  version: Version
  /** 雷达值（v2：相对自身 40-95，最强维恒为 95；v1 旧报告为 35-99 绝对刻度） */
  scores: DimScores
  /** 按得分排序的维度 key，topDims[0] 最强 */
  topDims: DimKey[]
  /** pro: 原型名；fun: 趣味称号 */
  archetypeName: string
  slogan: string
  coreInsight: string
  /** PRO 专属（v2）：原型匹配档位（高度匹配 / 较为匹配 / 特征较均衡） */
  archetypeTier?: string
  /** v1 遗留：原型匹配度 60-98，旧报告兼容展示 */
  archetypeMatch?: number
  /** v1 遗留：职业适配指数（v2 不再输出） */
  fitIndex?: number
  /** PRO 专属：迫选镜像回显（「在洞察与创造之间，你选择了洞察」） */
  mirror?: string[]
  radarLabels?: string[]
  careers?: CareerMatch[]
  advice?: { amplify: string; blindSpot: string }
  /** 质量信号：答题过快占比 / 同一选项占比（标注不拦截） */
  qc?: { fastRatio: number; sameKeyRatio: number }
  /** 题库版本号，改题后旧报告按旧版口径展示不迁移 */
  bankVersion?: string
  /** 计分版本号（v2 起写入；缺省视为 v1） */
  scoringVersion?: string
  /** fun 专属：不点名的职业适配钩子——较为适配及以上的职业方向数量（v2 全枚举 5~15） */
  careerFitHint?: number
}

export interface ReportItem {
  _id: string
  version: Version
  result: TestResult
  /** 交卷会话幂等键（云端 docId 即此值，03 §5） */
  sessionId?: string
  /** 原始答卷（云端 reports 结构对齐，05 §2） */
  answers?: Record<string, AnswerValue>
  createdAt: string | number
  /** 展示用，如 2026.09.18 20:36 */
  dateText?: string
}

/** 单题作答记录：选项 + 本题耗时（毫秒），用于质量信号 */
export interface AnswerValue {
  key: string
  ms: number
}

export interface QuizSession {
  /** 幂等键，进入答题时生成 */
  sessionId: string
  version: Version
  answers: Record<string, AnswerValue>
  startedAt: number
  updatedAt: number
}
