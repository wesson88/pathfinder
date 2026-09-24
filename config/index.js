const fs = require('fs')
const path = require('path')

const isProd = process.env.NODE_ENV === 'production'

// 上线闸门（三轮盲审 N4）：协议中的运营者名称仍是占位符时，禁止生产构建。
// 仅本地验证编译时可设 CT_ALLOW_PLACEHOLDER=1 跳过——该产物不得上传
if (isProd && process.env.TARO_APP_MOCK !== 'true' && process.env.CT_ALLOW_PLACEHOLDER !== '1') {
  const agreements = fs.readFileSync(path.join(__dirname, '../src/data/agreements.ts'), 'utf8')
  if (agreements.includes('【运营主体全称，企业认证后填写】') || agreements.includes('【上线日期】')) {
    throw new Error('[career-test] src/data/agreements.ts 的运营主体名称/隐私政策生效日期仍是占位符，禁止生产构建')
  }
}

const config = {
  projectName: 'career-test',
  date: '2026-9-21',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [],
  defineConstants: {
    // D4 盲审修订：mock 开关仅由构建期环境变量显式注入（dev 默认 true / build 默认 false）。
    // 用法：TARO_APP_MOCK=true npm run build:weapp
    'process.env.TARO_APP_MOCK': JSON.stringify(
      process.env.TARO_APP_MOCK || (isProd ? 'false' : 'true')
    )
  },
  copy: {
    // 分享卡静态图等按路径引用的资源（非 import 引用，需显式拷贝到 dist）
    patterns: [{ from: 'src/assets/', to: 'dist/assets/' }],
    options: {}
  },
  framework: 'react',
  compiler: 'webpack5',
  mini: {
    webpackChain(chain) {
      // 盲审裁决技术-2：生产构建 + mock 态由 src/config.ts 直接抛错兜底（fail-fast）。
      // 如需彻底摇树 src/mock/，可在此追加 NormalModuleReplacement 别名到空实现。
      return chain
    }
  },
  h5: {}
}

module.exports = function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge(config, require('./dev'))
  }
  return merge(config, require('./prod'))
}
