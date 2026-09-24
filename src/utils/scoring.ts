import { bankOf } from '../data/banks'
import { ARCHETYPES, DIM_META, DIM_ORDER, FUN_TITLES } from '../data/archetypes'
import { CAREERS } from '../data/careers'
import { AnswerValue, CareerMatch, DimKey, DimScores, Question, TestResult, Version } from '../data/types'

/** 题库版本号：题库任何改动都要递增，报告按此存档（M7 迭代闭环） */
export const BANK_VERSION = 'v1.0'
/** 计分版本号：计分公式任何改动都要递增；改动须过全枚举回归（scripts/enumerate-scoring.ts，02 §8） */
export const SCORING_VERSION = 'v2'

/** 档位阈值（02 §5，全枚举标定） */
export const ARCHETYPE_TIERS = { high: 0.8, mid: 0.6 }
export const CAREER_TIERS = { high: 0.6, mid: 0.3 }

/** 兼容 string 与 {key, ms} 两种作答值 */
const keyOf = (v: AnswerValue | string | undefined) =>
  v == null ? undefined : typeof v === 'string' ? v : v.key

const msOf = (v: AnswerValue | string | undefined) =>
  v == null || typeof v === 'string' ? 999999 : v.ms

const EPS = 1e-9

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

/** 去均值：画像的信息全在形状里（每人卷面原始总分为常数，绝对高低无意义，02 §5） */
function centered(v: number[]) {
  const mean = v.reduce((s, x) => s + x, 0) / v.length
  return v.map(x => x - mean)
}

const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0))

/** 余弦；任一向量为零（完全均衡画像）时返回 0 */
function cosine(a: number[], b: number[]) {
  const na = norm(a)
  const nb = norm(b)
  if (na < EPS || nb < EPS) return 0
  return a.reduce((s, x, i) => s + x * b[i], 0) / (na * nb)
}

/** 答卷稳定哈希（FNV-1a）：并列决胜用——同一份答卷结果恒定，人群层面不偏向任一维度 */
function answersHash(answers: Record<string, AnswerValue>) {
  const text = Object.keys(answers)
    .sort()
    .map(k => `${k}:${keyOf(answers[k])}`)
    .join('|')
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** 维度按选择率降序；并列时按答卷哈希轮转决胜（不按固定维度顺序） */
function rankDims(p: DimScores, hash: number): DimKey[] {
  const rot = hash % DIM_ORDER.length
  const tieOrder = (d: DimKey) => (DIM_ORDER.indexOf(d) - rot + DIM_ORDER.length) % DIM_ORDER.length
  return [...DIM_ORDER].sort((a, b) => {
    const diff = p[b] - p[a]
    return Math.abs(diff) > EPS ? diff : tieOrder(a) - tieOrder(b)
  })
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

const CAREER_TIER_NAMES = ['高度适配', '较为适配', '值得关注']

/** 绝对档（按形状相关系数 r） */
const absoluteCareerTier = (r: number) => (r >= CAREER_TIERS.high ? 0 : r >= CAREER_TIERS.mid ? 1 : 2)

/**
 * 职业档位（D34：按名次相对定档，拉开区分度）：Top1 高度 / Top2 较为 / Top3 值得关注，
 * 并以绝对档封顶——相关系数不够时不会因名次靠前而被抬高。
 */
export const careerTierOf = (r: number, rank = 0) =>
  CAREER_TIER_NAMES[Math.max(Math.min(rank, 2), absoluteCareerTier(r))]

export const archetypeTierOf = (sim: number) =>
  sim >= ARCHETYPE_TIERS.high ? '高度匹配' : sim >= ARCHETYPE_TIERS.mid ? '较为匹配' : '特征较均衡'

/**
 * 职业适配：画像与职业需求权重都去均值后比余弦（形状相关系数 r），全库按 r 排序。
 * 并列依次按加权选择率、职业库顺序决胜。内部数值只排序定档，对外只给档位。
 */
export function matchCareers(p: DimScores) {
  const pv = DIM_ORDER.map(d => p[d])
  const c = centered(pv)
  // 与报告雷达同一口径的「待激活」判定（radar < 60）：理由绝不引用待激活维度
  const pMax = Math.max(...pv)
  const lowDim = pv.map(x => (pMax > 0 ? Math.round(40 + (55 * x) / pMax) : 40) < 60)
  return CAREERS.map((career, index) => {
    const wv = DIM_ORDER.map(d => career.weights[d])
    const wc = centered(wv)
    const r = cosine(c, wc)
    const wsum = wv.reduce((s, x) => s + x, 0)
    const weighted = pv.reduce((s, x, i) => s + x * wv[i], 0) / (wsum || 1)
    // 匹配理由：只取用户与职业「都高于各自均值」的维度（c>0 且 wc>0）。
    // 三轮盲审产品 H1：原只看乘积为正，负负得正会把用户偏低、职业也不看重的维度写成「更看重的」
    const contrib = DIM_ORDER.map((d, i) => ({ d, c: c[i], w: wc[i], v: c[i] * wc[i] }))
      .filter(x => x.c > EPS && x.w > EPS && !lowDim[DIM_ORDER.indexOf(x.d)])
      .sort((a, b) => b.v - a.v)
    const hits = contrib.slice(0, 2).map(x => DIM_META[x.d].label)
    const reason =
      hits.length === 2
        ? `你在${hits[0]}与${hits[1]}上的倾向，正是这个方向更看重的`
        : hits.length === 1
          ? `你在${hits[0]}上的倾向，正是这个方向更看重的`
          : '这个方向与你的画像有部分交集'
    return { name: career.name, reason, reasonDims: contrib.slice(0, 2).map(x => x.d), r, weighted, index }
  }).sort((a, b) => {
    if (Math.abs(b.r - a.r) > EPS) return b.r - a.r
    if (Math.abs(b.weighted - a.weighted) > EPS) return b.weighted - a.weighted
    return a.index - b.index
  })
}

/** 迫选镜像回显（06 §3）：直接复述用户在迫选题上的取舍 */
function forcedMirror(questions: Question[], answers: Record<string, AnswerValue>) {
  const dimOf = (o?: { scores: Partial<DimScores> }) =>
    o ? DIM_ORDER.find(d => (o.scores[d] || 0) > 0) : undefined
  const lines: string[] = []
  for (const q of questions) {
    if (q.type !== 'forced') continue
    const key = keyOf(answers[q.id])
    const a = dimOf(q.options.find(o => o.key === key))
    const b = dimOf(q.options.find(o => o.key !== key))
    if (a && b) lines.push(`在${DIM_META[b].label}与${DIM_META[a].label}之间，你选择了${DIM_META[a].label}`)
  }
  return lines
}

/**
 * 计分引擎 v2（规范见项目记录《02-模块设计-题库》§5 与《13-题库工程规范-代码侧》）：
 * 逐题投票 → 选择率 → 雷达（相对自身）→ 去均值余弦匹配原型与职业 → 档位
 */
export function computeResult(
  version: Version,
  answers: Record<string, AnswerValue>
): TestResult {
  const questions = bankOf(version)

  // 完成度守门：空卷/半卷不允许生成报告，逐题校验而非键数统计
  const unanswered = questions.filter(q => !answers[q.id])
  if (unanswered.length > 0) {
    throw new Error(`INCOMPLETE_ANSWERS:${unanswered.length}`)
  }

  const { raw, maxRaw } = aggregate(questions, answers)

  // 选择率 p[d] ∈ [0,1]：随机作答时各维期望相同
  const p: DimScores = { insight: 0, creativity: 0, action: 0, collab: 0, stability: 0 }
  for (const dim of DIM_ORDER) p[dim] = maxRaw[dim] > 0 ? raw[dim] / maxRaw[dim] : 0
  const pMax = Math.max(...DIM_ORDER.map(d => p[d]))

  // 雷达（相对自身）：最强维恒为 95，其余按与最强维的比例
  const scores: DimScores = { insight: 0, creativity: 0, action: 0, collab: 0, stability: 0 }
  for (const dim of DIM_ORDER) scores[dim] = pMax > 0 ? Math.round(40 + (55 * p[dim]) / pMax) : 40

  const topDims = rankDims(p, answersHash(answers))
  const [d1, d2] = topDims
  const tieTop = Math.abs(p[d1] - p[d2]) < EPS
  const careers = matchCareers(p)
  const base = {
    version,
    scores,
    topDims,
    radarLabels: DIM_ORDER.map(d => DIM_META[d].label),
    qc: qualitySignals(questions, answers),
    bankVersion: BANK_VERSION,
    scoringVersion: SCORING_VERSION
  }

  if (version === 'fun') {
    const fun = FUN_TITLES[d1]
    const coreInsight = tieTop
      ? `你的天赋关键词是「${fun.title}」——你在${DIM_META[d1].label}与${DIM_META[d2].label}上的倾向不分伯仲。${fun.line}。`
      : `你的天赋关键词是「${fun.title}」。${fun.line}。`
    return {
      ...base,
      archetypeName: fun.title,
      slogan: fun.line,
      coreInsight,
      // 不点名钩子：较为适配及以上的职业方向数量（全枚举 5~15，从不为 0）
      careerFitHint: careers.filter(c => c.r >= CAREER_TIERS.mid).length
    }
  }

  // 原型 = 去均值画像与去均值理想画像（coreDims: 1.0 / 0.92 / 0.5）余弦最高者
  const c = centered(DIM_ORDER.map(d => p[d]))
  let bestKey = Object.keys(ARCHETYPES)[0]
  let bestSim = -Infinity
  for (const [key, arch] of Object.entries(ARCHETYPES)) {
    const ideal = centered(
      DIM_ORDER.map(d => (d === arch.coreDims[0] ? 1 : d === arch.coreDims[1] ? 0.92 : 0.5))
    )
    const sim = cosine(c, ideal)
    if (sim > bestSim + EPS) {
      bestSim = sim
      bestKey = key
    }
  }
  const archetype = ARCHETYPES[bestKey]
  const [a1, a2] = archetype.coreDims
  const top3: CareerMatch[] = careers.slice(0, 3).map((x, rank) => ({
    name: x.name,
    reason: x.reason,
    tier: careerTierOf(x.r, rank)
  }))
  const tier = archetypeTierOf(bestSim)
  // 核心洞察：均衡画像不硬说「最常展现」；原型核心维落在待激活时改为「倾向组合」措辞（三轮产品 M3）
  const coreLow = [a1, a2].some(d => scores[d] < 60)
  const coreInsight =
    tier === '特征较均衡'
      ? `你的五维倾向比较均衡，没有特别突出的一两项；其中与你最接近的是${DIM_META[a1].label}与${DIM_META[a2].label}的组合。${archetype.strength}。`
      : coreLow
        ? `你的倾向组合最接近${DIM_META[a1].label}与${DIM_META[a2].label}。${archetype.strength}。`
        : `你最常展现的是${DIM_META[a1].label}与${DIM_META[a2].label}的倾向。${archetype.strength}。`

  return {
    ...base,
    archetypeName: archetype.name,
    slogan: archetype.slogan,
    // 核心洞察引用原型自身维度，与称号同源（02 §5 ③）
    coreInsight,
    archetypeTier: tier,
    careers: top3,
    mirror: forcedMirror(questions, answers),
    advice: archetype.advice
  }
}
