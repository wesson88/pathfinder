/**
 * 计分全枚举回归（02 §8）：列尽每个版本的全部答法，逐一跑 computeResult，
 * 输出分布并按门槛判定。计分公式/题库/职业库/原型任何改动都须跑通本脚本再合入。
 *
 * 用法：npm run test:scoring
 */
import { bankOf } from '../src/data/banks'
import { AnswerValue, TestResult, Version } from '../src/data/types'
import { computeResult, matchCareers, CAREER_TIERS } from '../src/utils/scoring'
import { DIM_ORDER } from '../src/data/archetypes'
import { levelOf } from '../src/data/copy'

interface Stats {
  total: number
  top3: Map<string, number>
  top1: Map<string, number>
  archetypeTier: Map<string, number>
  archetypeName: Map<string, number>
  fitHintZero: number
  fitHint: number[]
  allLow: number
  noHigh: number
}

const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) || 0) + 1)
const share = (m: Map<string, number>, total: number) => Math.max(...m.values()) / total
const pct = (x: number) => `${(x * 100).toFixed(2)}%`
const quantile = (arr: number[], q: number) => arr[Math.min(arr.length - 1, Math.floor(q * arr.length))]

function enumerate(version: Version): Stats {
  const questions = bankOf(version)
  const radix = questions.map(q => q.options.length)
  const idx = radix.map(() => 0)
  const stats: Stats = {
    total: 0,
    top3: new Map(),
    top1: new Map(),
    archetypeTier: new Map(),
    archetypeName: new Map(),
    fitHintZero: 0,
    fitHint: [],
    allLow: 0,
    noHigh: 0
  }
  const fitCounts = new Map<number, number>()
  for (;;) {
    const answers: Record<string, AnswerValue> = {}
    questions.forEach((q, i) => (answers[q.id] = { key: q.options[idx[i]].key, ms: 5000 }))
    const r: TestResult = computeResult(version, answers)
    stats.total++
    const levels = DIM_ORDER.map(d => levelOf(r.scores[d]))
    if (levels.every(l => l === 'low')) stats.allLow++
    if (!levels.includes('high')) stats.noHigh++
    if (version === 'pro') {
      const names = (r.careers || []).map(c => c.name)
      inc(stats.top3, names.join(' | '))
      inc(stats.top1, names[0])
      inc(stats.archetypeTier, r.archetypeTier || '')
      inc(stats.archetypeName, r.archetypeName)
      // PRO 不输出钩子，但同一画像的钩子分布也纳入观察
      const hint = matchCareers(scoresToP(r)).filter(c => c.r >= CAREER_TIERS.mid).length
      fitCounts.set(hint, (fitCounts.get(hint) || 0) + 1)
    } else {
      const n = r.careerFitHint || 0
      if (n === 0) stats.fitHintZero++
      fitCounts.set(n, (fitCounts.get(n) || 0) + 1)
      inc(stats.top1, r.archetypeName)
    }
    // mixed-radix 进位
    let i = idx.length - 1
    while (i >= 0 && ++idx[i] === radix[i]) idx[i--] = 0
    if (i < 0) break
  }
  const sorted = [...fitCounts.entries()].sort((a, b) => a[0] - b[0])
  for (const [n, c] of sorted) for (let k = 0; k < c; k++) stats.fitHint.push(n)
  return stats
}

/** 由雷达值反推选择率的形状（雷达 = 40 + 55·p/pMax，与 p 同形状，去均值余弦不受缩放影响） */
function scoresToP(r: TestResult) {
  const p = { insight: 0, creativity: 0, action: 0, collab: 0, stability: 0 }
  for (const d of DIM_ORDER) p[d] = (r.scores[d] - 40) / 55
  return p
}

const failures: string[] = []
const gate = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? '✓' : '✗'} ${msg}`)
  if (!ok) failures.push(msg)
}

for (const version of ['fun', 'pro'] as Version[]) {
  const t0 = Date.now()
  const s = enumerate(version)
  console.log(`\n== ${version.toUpperCase()}：${s.total} 种答法（${((Date.now() - t0) / 1000).toFixed(1)}s）`)
  const hint = s.fitHint
  console.log(`  钩子 N（r≥${CAREER_TIERS.mid}）P5/P50/P95 = ${quantile(hint, 0.05)}/${quantile(hint, 0.5)}/${quantile(hint, 0.95)}`)
  console.log(`  无「优势区」维度占比 ${pct(s.noHigh / s.total)}；五维全「待激活」占比 ${pct(s.allLow / s.total)}`)
  gate(s.noHigh === 0, '每份报告至少一个优势区维度')
  gate(s.allLow === 0, '不存在五维全待激活')
  if (version === 'fun') {
    console.log(`  称号最大占比 ${pct(share(s.top1, s.total))}`)
    gate(s.fitHintZero === 0, '趣味版转化钩子 N 从不为 0')
    gate(share(s.top1, s.total) < 0.35, '趣味称号最大占比 < 35%')
  } else {
    console.log(`  不同 Top3 组合 ${s.top3.size}；最常见 Top3 占比 ${pct(share(s.top3, s.total))}`)
    console.log(`  Top1 职业 ${s.top1.size} 个；最大占比 ${pct(share(s.top1, s.total))}`)
    console.log(`  原型档位 ${[...s.archetypeTier.entries()].map(([k, v]) => `${k} ${pct(v / s.total)}`).join(' / ')}`)
    console.log(`  原型最大占比 ${pct(share(s.archetypeName, s.total))}（${s.archetypeName.size} 个原型可达）`)
    gate(share(s.top3, s.total) < 0.1, '最常见 Top3 占比 < 10%')
    gate(s.top1.size >= 20, 'Top1 职业可达数 ≥ 20')
    gate((s.archetypeTier.get('高度匹配') || 0) / s.total < 0.9, '原型「高度匹配」占比 < 90%')
    gate(s.archetypeName.size === 10, '10 个原型全部可达')
  }
}

if (failures.length) {
  console.error(`\n✗ 回归未通过（${failures.length} 项）`)
  process.exit(1)
}
console.log('\n✓ 回归通过')
