/**
 * 把 cloud/shared/ 下的共享模块复制进使用它的云函数目录（云函数独立部署，无法跨目录 require）。
 * 改 cloud/shared/ 后必须运行：npm run sync:cloud
 * 带 --check 时只校验副本是否与源一致（不一致退出码 1），供提交前检查。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const TARGETS = {
  'xpay.js': ['createOrder', 'payCallback', 'checkOrder'],
  'events.js': ['track']
}
const HEADER = '// ⚠ 自动生成：源文件 cloud/shared/{name}，由 npm run sync:cloud 复制，勿手改\n'

const check = process.argv.includes('--check')
let drift = 0

for (const [name, fns] of Object.entries(TARGETS)) {
  const src = HEADER.replace('{name}', name) + fs.readFileSync(path.join(ROOT, 'cloud/shared', name), 'utf8')
  for (const fn of fns) {
    const dest = path.join(ROOT, 'cloud/functions', fn, name)
    const current = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null
    if (current === src) continue
    if (check) {
      console.error(`✗ 副本过期：cloud/functions/${fn}/${name}`)
      drift++
    } else {
      fs.writeFileSync(dest, src)
      console.log(`→ cloud/functions/${fn}/${name}`)
    }
  }
}

// 埋点白名单：前端 TrackEvent 联合类型与云端 EVENTS 必须一致（10 §3 字典）
const { EVENTS } = require(path.join(ROOT, 'cloud/shared/events.js'))
const trackTs = fs.readFileSync(path.join(ROOT, 'src/utils/track.ts'), 'utf8')
const union = trackTs.slice(trackTs.indexOf('export type TrackEvent'), trackTs.indexOf('const MAX_PARAMS_BYTES'))
const front = [...union.matchAll(/'([a-z_]+)'/g)].map(m => m[1])
const diff = [...front.filter(e => !EVENTS.includes(e)), ...EVENTS.filter(e => !front.includes(e))]
if (diff.length) {
  console.error(`✗ 埋点白名单前后端不一致：${diff.join(', ')}`)
  drift++
}

if (drift) process.exit(1)
console.log(check ? '✓ 共享模块副本一致' : '✓ 同步完成')
