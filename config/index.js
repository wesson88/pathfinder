const isProd = process.env.NODE_ENV === 'production'

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
    patterns: [],
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
