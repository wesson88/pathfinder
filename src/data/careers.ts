import { DimKey, DimScores } from './types'

/**
 * 职业库：30 个职业 × 五维需求权重（0~1，一位小数）。
 * 规范见项目记录《13-题库工程规范-代码侧》§7：匹配分 = Σ(w×score)/Σw，可持续扩充，不动题库。
 */
export interface CareerItem {
  name: string
  weights: DimScores
}

const w = (insight: number, creativity: number, action: number, collab: number, stability: number): DimScores => ({
  insight, creativity, action, collab, stability
})

export const CAREERS: CareerItem[] = [
  { name: '产品策略 / 用户研究', weights: w(0.9, 0.7, 0.5, 0.8, 0.5) },
  { name: '品牌策划 / 内容创意', weights: w(0.7, 0.9, 0.6, 0.7, 0.4) },
  { name: '商业分析 / 战略咨询', weights: w(0.9, 0.6, 0.6, 0.7, 0.7) },
  { name: '交互 / 体验设计', weights: w(0.7, 0.9, 0.5, 0.6, 0.6) },
  { name: '软件开发 / 工程师', weights: w(0.8, 0.7, 0.7, 0.5, 0.9) },
  { name: '数据分析师', weights: w(1.0, 0.4, 0.5, 0.5, 0.9) },
  { name: '人工智能 / 算法研究', weights: w(1.0, 0.8, 0.5, 0.5, 0.8) },
  { name: '项目经理 / 交付管理', weights: w(0.6, 0.4, 0.9, 0.9, 0.8) },
  { name: '增长运营', weights: w(0.8, 0.7, 0.9, 0.6, 0.5) },
  { name: '用户运营 / 社群运营', weights: w(0.6, 0.5, 0.7, 1.0, 0.6) },
  { name: '销售 / 大客户经理', weights: w(0.7, 0.5, 0.9, 0.9, 0.6) },
  { name: '市场营销 / 活动策划', weights: w(0.6, 0.9, 0.9, 0.7, 0.4) },
  { name: '创业者 / 新业务开拓', weights: w(0.8, 0.9, 1.0, 0.7, 0.5) },
  { name: '人力资源 / 组织发展', weights: w(0.6, 0.5, 0.6, 1.0, 0.8) },
  { name: '培训师 / 企业教练', weights: w(0.8, 0.6, 0.6, 0.9, 0.7) },
  { name: '财务 / 审计', weights: w(0.8, 0.3, 0.5, 0.5, 1.0) },
  { name: '风控 / 合规', weights: w(0.9, 0.3, 0.5, 0.5, 1.0) },
  { name: '供应链 / 精益运营', weights: w(0.7, 0.4, 0.8, 0.7, 0.9) },
  { name: '质量管理 / 测试', weights: w(0.8, 0.4, 0.6, 0.6, 1.0) },
  { name: '客户成功 / 客户服务', weights: w(0.6, 0.4, 0.7, 1.0, 0.7) },
  { name: '视觉 / 品牌设计', weights: w(0.6, 1.0, 0.6, 0.5, 0.6) },
  { name: '文案 / 编剧 / 内容创作', weights: w(0.7, 1.0, 0.5, 0.5, 0.5) },
  { name: '教育 / 课程设计', weights: w(0.8, 0.8, 0.6, 0.9, 0.6) },
  { name: '心理咨询 / 教练', weights: w(0.9, 0.5, 0.5, 1.0, 0.7) },
  { name: '科研 / 智库研究', weights: w(1.0, 0.7, 0.4, 0.5, 0.9) },
  { name: '医疗 / 康复专业岗', weights: w(0.8, 0.4, 0.6, 0.8, 0.9) },
  { name: '法律 / 法务', weights: w(0.9, 0.4, 0.5, 0.6, 0.9) },
  { name: '新媒体 / 短视频运营', weights: w(0.6, 0.9, 0.9, 0.7, 0.4) },
  { name: '电商运营', weights: w(0.7, 0.6, 0.9, 0.7, 0.6) },
  { name: '行政 / 项目协同', weights: w(0.5, 0.4, 0.7, 0.8, 0.9) }
]

/** 该职业需求最重的两个维度（用于生成匹配理由） */
export function careerTopDims(item: CareerItem): [DimKey, DimKey] {
  const keys: DimKey[] = ['insight', 'creativity', 'action', 'collab', 'stability']
  const sorted = [...keys].sort((a, b) => item.weights[b] - item.weights[a])
  return [sorted[0], sorted[1]]
}
