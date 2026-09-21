import { Question } from './types'

/**
 * PRO 专业版题库：12 题 = 情境四选一 ×10（单维映射 3 分）+ 迫选二选一 ×2（胜方 2 分）。
 * 覆盖矩阵与分类分布见项目记录《13-题库工程规范-代码侧》§4。
 * v1.1（盲审修订）：pro-11/12 改行为化迫选；pro-01/03/09 洞察选项降赞许性（对齐出题规则 3/4）。
 */
export const QUESTIONS_PRO: Question[] = [
  {
    id: 'pro-01',
    type: 'single',
    category: '职业行为偏好',
    hint: '本题用于评估模糊情境下的切入方式',
    question: '接到一个目标模糊的新任务，你通常会先？',
    options: [
      { key: 'A', text: '先梳理清楚任务的要求和限制', scores: { insight: 3 } },
      { key: 'B', text: '把第一步做起来，边做边校准方向', scores: { action: 3 } },
      { key: 'C', text: '找人聊，把各方的期待和边界对齐', scores: { collab: 3 } },
      { key: 'D', text: '列一个清晰的计划，把资源和节奏排好', scores: { stability: 3 } }
    ]
  },
  {
    id: 'pro-02',
    type: 'single',
    category: '职业行为偏好',
    hint: '本题用于评估你在团队中的自然角色',
    question: '团队讨论时，你更常扮演哪种角色？',
    options: [
      { key: 'A', text: '提出大家没想到的新角度', scores: { creativity: 3 } },
      { key: 'B', text: '把讨论推进成可以马上执行的下一步', scores: { action: 3 } },
      { key: 'C', text: '把安静成员的想法接出来、串起来', scores: { collab: 3 } },
      { key: 'D', text: '帮大家收拢分歧，形成明确的结论', scores: { stability: 3 } }
    ]
  },
  {
    id: 'pro-03',
    type: 'single',
    category: '学习与决策',
    hint: '本题用于评估你的学习方式',
    question: '要快速搞懂一个陌生领域，你会？',
    options: [
      { key: 'A', text: '先理清这个领域的整体框架和脉络', scores: { insight: 3 } },
      { key: 'B', text: '用类比和联想，把它和自己熟悉的东西连起来', scores: { creativity: 3 } },
      { key: 'C', text: '直接找这个领域的高手请教', scores: { collab: 3 } },
      { key: 'D', text: '找经典资料，按体系一步步啃', scores: { stability: 3 } }
    ]
  },
  {
    id: 'pro-04',
    type: 'single',
    category: '学习与决策',
    hint: '本题用于评估你的决策风格',
    question: '两个方向都不错的方案摆在面前，你会？',
    options: [
      { key: 'A', text: '列出关键判断标准，逐项权衡', scores: { insight: 3 } },
      { key: 'B', text: '想想有没有能兼顾两者的第三种做法', scores: { creativity: 3 } },
      { key: 'C', text: '挑一个先跑起来，用结果说话', scores: { action: 3 } },
      { key: 'D', text: '选更稳、更可控的那个', scores: { stability: 3 } }
    ]
  },
  {
    id: 'pro-05',
    type: 'single',
    category: '协作与沟通',
    hint: '本题用于评估僵局中的自然反应',
    question: '项目讨论陷入僵局时，你更可能？',
    options: [
      { key: 'A', text: '重新定义问题，点出大家真正在争什么', scores: { insight: 3 } },
      { key: 'B', text: '抛出一个打破惯例的新思路', scores: { creativity: 3 } },
      { key: 'C', text: '建议先小范围试一下，别继续空转', scores: { action: 3 } },
      { key: 'D', text: '逐个听取意见，把共识一点点拼出来', scores: { collab: 3 } }
    ]
  },
  {
    id: 'pro-06',
    type: 'single',
    category: '协作与沟通',
    hint: '本题用于评估你对团队的支持方式',
    question: '新同事融入团队比较慢，你会？',
    options: [
      { key: 'A', text: '观察他卡在哪里，帮他找到问题根源', scores: { insight: 3 } },
      { key: 'B', text: '主动拉他一起做一件具体的事', scores: { action: 3 } },
      { key: 'C', text: '多创造几次轻松的集体相处机会', scores: { collab: 3 } },
      { key: 'D', text: '给他一份清晰的流程和约定', scores: { stability: 3 } }
    ]
  },
  {
    id: 'pro-07',
    type: 'single',
    category: '能量与韧性',
    hint: '本题用于评估你的内在驱动力来源',
    question: '连续高强度推进项目，最能给你充电的是？',
    options: [
      { key: 'A', text: '冒出越来越多的新想法', scores: { creativity: 3 } },
      { key: 'B', text: '看到进度条实打实地往前走', scores: { action: 3 } },
      { key: 'C', text: '和伙伴一起扛下挑战的默契', scores: { collab: 3 } },
      { key: 'D', text: '一切都在计划内、尽在掌握', scores: { stability: 3 } }
    ]
  },
  {
    id: 'pro-08',
    type: 'single',
    category: '能量与韧性',
    hint: '本题用于评估你的恢复方式',
    question: '搞砸了一件事，你恢复的方式更接近？',
    options: [
      { key: 'A', text: '把原因拆透，沉淀成下次能用的方法', scores: { insight: 3 } },
      { key: 'B', text: '换个玩法重新开始，不纠结旧的', scores: { creativity: 3 } },
      { key: 'C', text: '找信得过的人聊聊，被理解就好了', scores: { collab: 3 } },
      { key: 'D', text: '整理好状态，按自己的节奏回到正轨', scores: { stability: 3 } }
    ]
  },
  {
    id: 'pro-09',
    type: 'single',
    category: '职业行为偏好',
    hint: '本题用于评估长期规划中的依赖项',
    question: '做一份重要的长期规划时，你更依赖？',
    options: [
      { key: 'A', text: '对行业走向的观察和判断', scores: { insight: 3 } },
      { key: 'B', text: '对未来可能性的想象', scores: { creativity: 3 } },
      { key: 'C', text: '把大目标切成马上能做的行动', scores: { action: 3 } },
      { key: 'D', text: '对风险和底线的把控', scores: { stability: 3 } }
    ]
  },
  {
    id: 'pro-10',
    type: 'single',
    category: '学习与决策',
    hint: '本题用于评估你的复盘视角',
    question: '复盘一个成功的项目，你更想深挖？',
    options: [
      { key: 'A', text: '成功背后可复制的规律', scores: { insight: 3 } },
      { key: 'B', text: '当初哪些灵感值得继续放大', scores: { creativity: 3 } },
      { key: 'C', text: '哪些执行动作起了关键作用', scores: { action: 3 } },
      { key: 'D', text: '团队配合里发生了哪些化学反应', scores: { collab: 3 } }
    ]
  },
  {
    id: 'pro-11',
    type: 'forced',
    category: '职业行为偏好',
    hint: '两个都可能像你？请选更本能的那一个',
    question: '项目方向一时不明朗，你的第一反应更接近？',
    options: [
      { key: 'A', text: '先把问题本身画清楚：我们到底在解决什么', scores: { insight: 2 } },
      { key: 'B', text: '先抛几个大胆的方案出来，再慢慢收敛', scores: { creativity: 2 } }
    ]
  },
  {
    id: 'pro-12',
    type: 'forced',
    category: '协作与沟通',
    hint: '两个都可能像你？请选更本能的那一个',
    question: '团队接到一个新任务，你更常先做哪件事？',
    options: [
      { key: 'A', text: '把任务拆成步骤，马上推动第一步跑起来', scores: { action: 2 } },
      { key: 'B', text: '先确认每个人的分工和状态，让大家顺畅配合', scores: { collab: 2 } }
    ]
  }
]
