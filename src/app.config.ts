export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/record/index',
    'pages/version-select/index',
    'pages/quiz/index',
    'pages/pay-confirm/index',
    'pages/report/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#7C5CFC',
    navigationBarTitleText: '天赋星球',
    navigationBarTextStyle: 'white'
  },
  tabBar: {
    color: '#9CA3AF',
    selectedColor: '#7C5CFC',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/home/index', text: '发现' },
      { pagePath: 'pages/record/index', text: '记录' }
    ]
  }
})
