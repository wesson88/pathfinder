# 天赋星球（pathfinder）

职业天赋测评微信小程序：趣味版免费 · PRO 深度版每次付费生成 1 份报告、永久查看（D26）。
技术栈：Taro 4 + React 18 + TypeScript + Sass；后端为微信云开发（云函数 ×11 + 云数据库 6 集合）。

## 快速开始

```bash
npm install
npm run dev:weapp      # 开发模式（默认 mock=true，微信开发者工具导入本项目根目录预览 dist/）
npm run build:weapp    # 生产构建（默认 mock=false；误开 mock 会构建失败兜底）
```

- **mock 模式**：由构建期环境变量 `TARO_APP_MOCK` 显式注入（D4 修订），无需云端即可跑通全流程（含模拟支付）。
  显式开启生产 mock：`TARO_APP_MOCK=true npm run build:weapp`（会触发 fail-fast 抛错，属预期防护）。
- **接真实云端**：`src/config.ts` 填 `CLOUD_ENV`；开通云开发后上传 `cloud/functions/` 下 11 个云函数；创建 6 个集合：`sessions` / `reports` / `orders` / `feedback` / `counters` / `events`。

## 目录结构

```
src/
├── pages/            6 页面：home(发现) record(记录) version-select quiz pay-confirm report
├── components/       RadarChart（Canvas 2D 五维雷达图，点按维度出解释）
├── utils/            scoring 计分引擎 / storage 本地会话与缓存 / cloud 云调用出口 / track 埋点出口
├── data/             题库 ×2 / archetypes / careers / copy 文案库 / agreements 协议 / types
├── mock/             mock 云函数实现（同签名切换）
└── config.ts         CLOUD_ENV / TARO_APP_MOCK / 双渠道价格 / PAY_IOS_MODE
cloud/functions/      login getStats submitTest getReports createOrder payCallback
                      checkOrder submitFeedback deleteMyData sessionSync track
```

## 关键设计

- **前端厚、云端薄**：计分、报告生成全在本地（纯函数 `computeResult`），云端做身份归属、订单真相、存档与防线校验。
- **幂等交卷**：报告 `_id = sessionId`，云端事务内复核订单 + 条件核销，冲突重试 ≤3（`submitTest`）；幂等去重校验 openid 归属。
- **云端防线**：`submitTest` 逐题校验（qid/选项与题库映射一致）+ result 结构校验 + 单 openid 24h 频控；
  服务端权威计分（引擎打包进云函数）为可选演进，当前计分在前端属明示取舍。
- **全终端小程序虚拟支付（D25）**：`createOrder`（code 换 session_key → 落单 → 签名 signData）→ 前端 `wx.requestVirtualPayment`；
  到账双保险：发货推送 `payCallback` + `checkOrder` 主动查单补写，均以 `xpay/query_order` 权威查单为准、`created → paid` 条件更新（D14）；
  推送处理失败返回非 0 让平台重推。签名/查单封装唯一源在 `cloud/shared/xpay.js`，改后运行 `npm run sync:cloud` 复制到 3 个支付云函数。
- **清除数据**：报告/反馈/事件逐集合删除并汇总结果，任一失败返回失败可重试（界面以云端结果为准）；已支付未使用订单保留归属，其余订单 openid 换随机不可逆标识；查单原文清空；计数回减。
- **合规入口**：首页首次进入隐私告知（同意前不采集行为数据）；首页/报告页页脚常驻三份协议 + 联系客服；报告页反馈区（`submitFeedback` 内 msgSecCheck，`config.json` 声明 openapi 权限）。
- **计分 v2（只比形状）**：选择率 → 雷达相对自身 → 去均值余弦匹配原型与职业 → 对外只给档位 + 脚注（D27）。
  计分/题库/职业库/原型任何改动须跑 `npm run test:scoring`（全枚举 419 万种 PRO 答法，约 6 分钟，带门槛判定）。

## 联调清单（上线前）

1. 企业主体认证 + ICP 备案 + 后台开通「小程序虚拟支付」，配置 PRO 道具（安卓 ¥0.99 / iOS 档位 ¥1）
2. 云函数 `createOrder / payCallback / checkOrder` 配置环境变量：`WX_APPID`、`WX_APPSECRET`、`XPAY_ENV`（1 沙箱 / 0 正式）、`XPAY_OFFER_ID`、`XPAY_APPKEY`（与 env 对应）、`XPAY_PRODUCT_ID`、`XPAY_PRODUCT_ID_IOS`
3. 云开发「消息推送」订阅 `xpay_goods_deliver_notify` → `payCallback`
4. 沙箱联调：安卓 + iOS 真机各跑通 下单 → 支付 → 推送 → 查单 → 核销 → 退款；签名与字段逐项对照官方文档（`cloud/shared/xpay.js` 头注释）
5. 集合权限：全部改为「仅创建者可读写」（控制台默认值可能允许所有用户读）；建索引 `reports: openid+createdAt`、`orders: openid+status`、`events: event+createdAt / expireAt`
6. `src/data/agreements.ts` 的 `OPERATOR_NAME` 替换为营业执照主体全称
7. 平台后台《用户隐私保护指引》与 `agreements.ts` 隐私政策口径一致
8. `counters` 集合可预建 `_id: 'reports'` 文档（未建时 submitTest 会自动创建）

## 文档

设计记录（10 模块 + 决策日志 D1-D24 + 盲审裁决）见 vault：`20-知识/项目记录/career-test/`；
代码侧题库工程规范见 `20-知识/项目记录/career-test/13-题库工程规范-代码侧.md`。
