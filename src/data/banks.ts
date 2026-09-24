import { QUESTIONS_FUN } from './questions-fun'
import { QUESTIONS_PRO } from './questions-pro'
import { Question, Version } from './types'

/** 题库唯一出口：版本 → 题目列表（quiz/scoring/storage 原各持一份三元分支，收敛于此） */
export const bankOf = (version: Version): Question[] =>
  version === 'pro' ? QUESTIONS_PRO : QUESTIONS_FUN
