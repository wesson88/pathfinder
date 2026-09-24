import { useEffect, useRef } from 'react'
import Taro from '@tarojs/taro'
import { Canvas } from '@tarojs/components'
import { DIM_ORDER } from '../../data/archetypes'
import { DimKey, DimScores } from '../../data/types'
import './index.scss'

interface Props {
  scores: DimScores
  labels: string[]
  /** 画布 CSS 尺寸（px） */
  size?: number
  /** 点按某维度顶点 → 报告页弹解释浮层（D17） */
  onTapDim?: (dim: DimKey) => void
}

const RING_STEPS = [0.25, 0.5, 0.75, 1]

/**
 * 五维雷达图（ADR：自绘 Canvas 2D，不引 echarts）。
 * 画布按 devicePixelRatio 放大保证清晰；点按最近顶点回调 onTapDim。
 * 触点为页面坐标，命中计算前先减去画布的页面偏移（code review 修复）。
 */
export default function RadarChart({ scores, labels, size = 320, onTapDim }: Props) {
  const canvasId = useRef(`radar-${Math.random().toString(36).slice(2, 8)}`)
  const verticesRef = useRef<{ x: number; y: number; dim: DimKey }[]>([])
  const offsetRef = useRef<{ left: number; top: number }>({ left: 0, top: 0 })

  useEffect(() => {
    const query = Taro.createSelectorQuery()
    query
      .select(`#${canvasId.current}`)
      .fields({ node: true, size: true, rect: true })
      .exec((res) => {
        const item = res && res[0]
        if (!item || !item.node) return
        const canvas = item.node
        // 记录画布页面偏移，供触点坐标换算
        offsetRef.current = { left: item.left || 0, top: item.top || 0 }
        const dpr = (Taro.getSystemInfoSync().pixelRatio) || 2
        canvas.width = size * dpr
        canvas.height = size * dpr
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.scale(dpr, dpr)

        const cx = size / 2
        const cy = size / 2
        const radius = size * 0.32
        const labelRadius = size * 0.42
        const angleOf = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / 5

        // 顶点坐标（数据层）
        const vertices = DIM_ORDER.map((dim, i) => {
          const a = angleOf(i)
          const v = Math.min(99, Math.max(0, scores[dim] || 0)) / 100
          return { x: cx + Math.cos(a) * radius * v, y: cy + Math.sin(a) * radius * v, a }
        })
        // 点按热区（外圈顶点）
        verticesRef.current = DIM_ORDER.map((dim, i) => {
          const a = angleOf(i)
          return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius, dim }
        })

        ctx.clearRect(0, 0, size, size)

        // 网格环
        ctx.strokeStyle = '#ECE9FA'
        ctx.lineWidth = 1
        RING_STEPS.forEach((step) => {
          ctx.beginPath()
          for (let i = 0; i <= 5; i++) {
            const a = angleOf(i % 5)
            const x = cx + Math.cos(a) * radius * step
            const y = cy + Math.sin(a) * radius * step
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          }
          ctx.stroke()
        })
        // 轴线
        for (let i = 0; i < 5; i++) {
          const a = angleOf(i)
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius)
          ctx.stroke()
        }

        // 数据多边形
        ctx.beginPath()
        vertices.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
        ctx.closePath()
        const grad = ctx.createLinearGradient(0, 0, size, size)
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.35)')
        grad.addColorStop(1, 'rgba(109, 40, 217, 0.35)')
        ctx.fillStyle = grad
        ctx.fill()
        ctx.strokeStyle = '#7C5CFC'
        ctx.lineWidth = 2
        ctx.stroke()
        // 顶点圆点
        vertices.forEach((p) => {
          ctx.beginPath()
          ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
          ctx.fillStyle = '#6D28D9'
          ctx.fill()
        })

        // 维度标签（分数 + 名称）
        ctx.fillStyle = '#1F2333'
        ctx.font = '600 12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        DIM_ORDER.forEach((dim, i) => {
          const a = angleOf(i)
          const x = cx + Math.cos(a) * labelRadius
          const y = cy + Math.sin(a) * labelRadius
          ctx.fillText(labels[i] || dim, x, y - 8)
          ctx.fillStyle = '#7C5CFC'
          ctx.font = '700 14px sans-serif'
          ctx.fillText(String(scores[dim] || 0), x, y + 10)
          ctx.fillStyle = '#1F2333'
          ctx.font = '600 12px sans-serif'
        })
      })
  }, [scores, labels, size])

  const handleTap = (e: any) => {
    if (!onTapDim) return
    const touch = e.changedTouches && e.changedTouches[0]
    if (!touch) return
    // 页面坐标 → 画布本地坐标
    const x = touch.x - offsetRef.current.left
    const y = touch.y - offsetRef.current.top
    let nearest: { d: number; dim: DimKey } | null = null
    for (const v of verticesRef.current) {
      const d = Math.hypot(v.x - x, v.y - y)
      if (!nearest || d < nearest.d) nearest = { d, dim: v.dim }
    }
    // 命中阈值：顶点周围 36px
    if (nearest && nearest.d <= 36) onTapDim(nearest.dim)
  }

  return (
    <Canvas
      type='2d'
      id={canvasId.current}
      className='radar-canvas'
      style={{ width: `${size}px`, height: `${size}px` }}
      onTouchEnd={handleTap}
    />
  )
}
