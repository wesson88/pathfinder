/** 测试版本：趣味版（免费）/ PRO 专业版（付费） */
export type Version = 'fun' | 'pro'

/** 五大能力维度 */
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
  /** 出题说明，如「本题用于评估模糊情境下的认知偏好」 */
  hint?: string
  question: string
  options: QuestionOption[]
}

export interface CareerMatch {
  name: string
  reason: string
  /** 适配百分比 */
  percent: number
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
  /** 各维度归一化得分 35-99 */
  scores: DimScores
  /** 按得分排序的维度 key，topDims[0] 最强 */
  topDims: DimKey[]
  /** pro: 原型名；fun: 趣味称号 */
  archetypeName: string
  slogan: string
  coreInsight: string
  /** pro 专属：与理想画像的匹配度 60-98 */
  archetypeMatch?: number
  /** PRO 专属：职业适配指数 */
  fitIndex?: number
  radarLabels?: string[]
  careers?: CareerMatch[]
  advice?: { amplify: string; blindSpot: string }
  /** 质量信号：答题过快占比 / 同一选项占比（标注不拦截） */
  qc?: { fastRatio: number; sameKeyRatio: number }
  /** 题库版本号，改题后旧报告按旧版口径展示不迁移 */
  bankVersion?: string
  /** fun 专属：不点名的职业适配钩子——与你较为适配的职业方向数量（D16 盲审修订：数量钩子替代卖点罗列） */
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
