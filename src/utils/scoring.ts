import { bankOf } from '../data/banks'
import { ARCHETYPES, DIM_META, DIM_ORDER, FUN_TITLES } from '../data/archetypes'
import { CAREERS, careerTopDims } from '../data/careers'
import { AnswerValue, DimKey, DimScores, Question, TestResult, Version } from '../data/types'

/** 题库版本号：题库任何改动都要递增，报告按此存档（M7 迭代闭环） */
export const BANK_VERSION = 'v1.0'

/** 兼容 string 与 {key, ms} 两种作答值 */
const keyOf = (v: AnswerValue | string | undefined) =>
  v == null ? undefined : typeof v === 'string' ? v : v.key

const msOf = (v: AnswerValue | string | undefined) =>
  v == null || typeof v === 'string' ? 999999 : v.ms

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

/** 汇总原始分 + 各维度理论满分（按维度独立归一化，抵消覆盖槽数差异） */
function aggregate(questions: Question[], answers: Record<string, AnswerValue>) {
  const raw: DimScores = { insight: 0, creativity: 0, action: 0, collab: 0, stability: 0 }
  const maxRaw: DimScores = { insight: 0, creativity: 0, action: 0, collab: 0, stability: 0 }
  for (const q of questions) {
    for (const dim of DIM_ORDER) {
      const best = Math.max(...q.options.map(o => o.scores[dim] || 0))
      maxRaw[dim] += best
    }
    const opt = q.options.find(o => o.key === keyOf(answers[q.id]))
    if (!opt) continue
    for (const dim of DIM_ORDER) raw[dim] += opt.scores[dim] || 0
  }
  return { raw, maxRaw }
}

/** 余弦相似度 */
function cosine(a: number[], b: number[]) {
  const dot = a.reduce((s, x, i) => s + x * b[i], 0)
  const na = Math.sqrt(a.reduce((s, x) => s + x * x, 0))
  const nb = Math.sqrt(b.reduce((s, x) => s + x * x, 0))
  return dot / (na * nb || 1)
}

/** 质量信号：答题过快占比 + 同一选项占比（标注不拦截） */
function qualitySignals(questions: Question[], answers: Record<string, AnswerValue>) {
  const done = questions.filter(q => answers[q.id])
  if (!done.length) return { fastRatio: 0, sameKeyRatio: 0 }
  const fast = done.filter(q => msOf(answers[q.id]) < 2000).length
  const keyCount: Record<string, number> = {}
  done.forEach(q => {
    const k = keyOf(answers[q.id]) || ''
    keyCount[k] = (keyCount[k] || 0) + 1
  })
  const topKey = Math.max(...Object.values(keyCount))
  return { fastRatio: fast / done.length, sameKeyRatio: topKey / done.length }
}

/** 职业适配：权重矩阵加权平均。内部数值仅用于排序，对外档位化展示（02 §5 展示口径） */
function matchCareers(scores: DimScores) {
  return CAREERS.map(c => {
    const wsum = DIM_ORDER.reduce((s, d) => s + c.weights[d], 0)
    const v = DIM_ORDER.reduce((s, d) => s + c.weights[d] * scores[d], 0) / (wsum || 1)
    const [wa, wb] = careerTopDims(c)
    return {
      name: c.name,
      reason: `这个方向最看重你的${DIM_META[wa].label}与${DIM_META[wb].label}`,
      percent: clamp(Math.round(v * 1.08), 60, 97)
    }
  }).sort((a, b) => b.percent - a.percent)
}

/**
 * 计分引擎（规范见项目记录《02-模块设计-题库》与《13-题库工程规范-代码侧》）：
 * 逐题投票 → 按维度独立归一化（35~99）→ 相似度匹配原型 → 职业权重矩阵匹配 top3
 */
export function computeResult(
  version: Version,
  answers: Record<string, AnswerValue>
): TestResult {
  const questions = bankOf(version)

  // 完成度守门（盲审修订）：空卷/半卷不允许生成报告，逐题校验而非键数统计
  const unanswered = questions.filter(q => !answers[q.id])
  if (unanswered.length > 0) {
    throw new Error(`INCOMPLETE_ANSWERS:${unanswered.length}`)
  }

  const { raw, maxRaw } = aggregate(questions, answers)

  const scores: DimScores = { insight: 0, creativity: 0, action: 0, collab: 0, stability: 0 }
  for (const dim of DIM_ORDER) {
    scores[dim] = maxRaw[dim] > 0 ? clamp(Math.round(35 + (raw[dim] / maxRaw[dim]) * 64), 35, 99) : 35
  }
  const topDims = [...DIM_ORDER].sort((a, b) => scores[b] - scores[a])
  const [d1, d2] = topDims
  const n1 = DIM_META[d1].label
  const n2 = DIM_META[d2].label
  const qc = qualitySignals(questions, answers)

  if (version === 'fun') {
    const fun = FUN_TITLES[d1]
    return {
      version,
      scores,
      topDims,
      archetypeName: fun.title,
      slogan: fun.line,
      coreInsight: `你的天赋关键词是「${fun.title}」。${fun.line}。`,
      radarLabels: DIM_ORDER.map(d => DIM_META[d].label),
      // 不点名钩子：较为适配的职业方向数量（D16 盲审修订）
      careerFitHint: matchCareers(scores).filter(c => c.percent >= 65).length,
      qc,
      bankVersion: BANK_VERSION
    }
  }

  // 原型 = 五维画像与 10 张理想画像（coreDims: 1.0 / 0.92 / 0.5）的余弦相似度最高者
  const profile = DIM_ORDER.map(d => scores[d] / 100)
  let bestKey = 'creativity+insight'
  let bestSim = -1
  for (const [key, arch] of Object.entries(ARCHETYPES)) {
    const ideal = DIM_ORDER.map(d =>
      d === arch.coreDims[0] ? 1 : d === arch.coreDims[1] ? 0.92 : 0.5
    )
    const sim = cosine(profile, ideal)
    if (sim > bestSim) {
      bestSim = sim
      bestKey = key
    }
  }
  const archetype = ARCHETYPES[bestKey]
  const archetypeMatch = clamp(Math.round(60 + (bestSim - 0.9) * 475), 60, 98)
  const fitIndex = clamp(Math.round(scores[d1] * 0.6 + scores[d2] * 0.4), 60, 98)

  // 职业适配 = 权重矩阵加权平均，全库排序取 top3（对外档位化展示）
  const careers = matchCareers(scores).slice(0, 3)

  return {
    version,
    scores,
    topDims,
    archetypeName: archetype.name,
    slogan: archetype.slogan,
    coreInsight: `你最突出的能力是${n1}与${n2}。${archetype.strength}。`,
    archetypeMatch,
    fitIndex,
    radarLabels: DIM_ORDER.map(d => DIM_META[d].label),
    careers,
    advice: archetype.advice,
    qc,
    bankVersion: BANK_VERSION
  }
}
