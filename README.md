# 天赋星球（pathfinder）

职业天赋测评微信小程序：趣味版免费 · PRO 付费解锁完整报告。
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
- **支付双保险**：`payCallback` 回调 + `checkOrder` 主动查单补写，均为 `created → paid` 条件更新（D14）；
  落账一律以 `cloudPay.queryOrder` 权威查单结果为准——回调事件字段可被 callFunction 直调伪造，不采信。
- **清除数据**：报告/会话/事件/反馈删除，订单匿名化留存（已支付订单保留归属，付费权益不受影响），计数同步回减。
- **iOS 分阶段**：`PAY_IOS_MODE='hidden'`（PRO 卡整体不展示）→ 开通虚拟支付后切 `'iap'`，不改代码（D12）。
- **档位化展示**：匹配度/职业吻合度内部数值仅排序，对外展示档位 + 脚注（盲审 C2 防伪精度）。

## 联调清单（上线前）

1. `cloud/functions/createOrder|checkOrder|payCallback` 配置 `WECHAT_MCH_ID`（商户号）；`payCallback` 未配置时拒绝落账（查询验账模式，无需商户密钥验签）
2. 云开发控制台开通 cloudPay 并关联商户号
3. 后台实测「虚拟支付」入口：类目在开放名单 → 切 `PAY_IOS_MODE='iap'`；不在 → 维持 hidden（降级预案）
4. ICP 备案 + 《用户隐私保护指引》配置（提审硬前置，见 09 文档）
5. `counters` 集合可预建 `_id: 'reports'` 文档（未建时 submitTest 会自动创建）

## 文档

设计记录（10 模块 + 决策日志 D1-D24 + 盲审裁决）见 vault：`20-知识/项目记录/career-test/`；
代码侧题库工程规范见 `20-知识/项目记录/career-test/13-题库工程规范-代码侧.md`。
