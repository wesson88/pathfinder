import { Question } from './types'

/**
 * 趣味版题库：6 道生活场景情境题（四选一，单维映射 2 分）。
 * 覆盖矩阵：洞察 5 / 创造 5 / 行动 5 / 协作 5 / 稳定 4，详见项目记录《13-题库工程规范-代码侧》
 */
export const QUESTIONS_FUN: Question[] = [
  {
    id: 'fun-01',
    question: '朋友遇到难题时，你通常会？',
    options: [
      { key: 'A', text: '帮他梳理问题，找出关键点', scores: { insight: 2 } },
      { key: 'B', text: '先听他倾诉，让他放松下来', scores: { collab: 2 } },
      { key: 'C', text: '马上行动，一起解决问题', scores: { action: 2 } },
      { key: 'D', text: '分享一个新奇的解决思路', scores: { creativity: 2 } }
    ]
  },
  {
    id: 'fun-02',
    question: '周末你更享受哪种状态？',
    options: [
      { key: 'A', text: '独处研究感兴趣的东西', scores: { insight: 2 } },
      { key: 'B', text: '去探索一家没去过的新店', scores: { creativity: 2 } },
      { key: 'C', text: '来一场说走就走的运动', scores: { action: 2 } },
      { key: 'D', text: '按熟悉的节奏，安稳地过一天', scores: { stability: 2 } }
    ]
  },
  {
    id: 'fun-03',
    question: '进入一个新环境，你会？',
    options: [
      { key: 'A', text: '先观察大家的相处模式', scores: { insight: 2 } },
      { key: 'B', text: '用一个小才艺打破僵局', scores: { creativity: 2 } },
      { key: 'C', text: '主动张罗第一次集体活动', scores: { collab: 2 } },
      { key: 'D', text: '做好自己的事，稳稳地融入', scores: { stability: 2 } }
    ]
  },
  {
    id: 'fun-04',
    question: '大家都在讨论的一件新鲜事，你通常会？',
    options: [
      { key: 'A', text: '先把前因后果查明白，搞懂是怎么回事', scores: { insight: 2 } },
      { key: 'B', text: '忍不住想些别人没提过的角度', scores: { creativity: 2 } },
      { key: 'C', text: '直接上手试一试，体验过才有发言权', scores: { action: 2 } },
      { key: 'D', text: '拉上朋友一起讨论，越聊越起劲', scores: { collab: 2 } }
    ]
  },
  {
    id: 'fun-05',
    question: '合作过的伙伴最常夸你什么？',
    options: [
      { key: 'A', text: '总有让人眼前一亮的点子', scores: { creativity: 2 } },
      { key: 'B', text: '说干就干，执行力强', scores: { action: 2 } },
      { key: 'C', text: '有你在，配合特别顺', scores: { collab: 2 } },
      { key: 'D', text: '稳稳的，从不掉链子', scores: { stability: 2 } }
    ]
  },
  {
    id: 'fun-06',
    question: '如果有一周假期，你会？',
    options: [
      { key: 'A', text: '把目的地研究透，做一条深度路线', scores: { insight: 2 } },
      { key: 'B', text: '说走就走，边走边定', scores: { action: 2 } },
      { key: 'C', text: '约上一群朋友，热热闹闹出发', scores: { collab: 2 } },
      { key: 'D', text: '按计划安然度过，好好休息', scores: { stability: 2 } }
    ]
  }
]
