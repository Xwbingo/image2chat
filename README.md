# image2chat

一款基于 Web 的 AI 图像生成聊天应用，支持多家中转站（Packy / RunAPI / uuapi / 自定义），可在浏览器或作为 PWA 安装到手机使用。

> 通过 OpenAI 兼容的 `gpt-image-2` 模型，支持**文生图**和**图片编辑**（含多张参考图）两种模式，会话数据全部本地存储（IndexedDB），不上云。

---

## 主要功能

- 🎨 **文生图**：输入文字描述生成图片
- ✏️ **图片编辑**：上传 **1-3 张** 参考图 + 文字描述进行二次创作，可混合引用 AI 生成的图与本地图片
- 💬 **多轮会话**：聊天窗口风格 UI，会话历史完整保留；侧边栏按生成中 / 失败状态着色（琥珀色 / 红色）方便扫一眼识别
- 🔌 **多中转站**：首次启动自动种子 Packy / RunAPI / uuapi 三个内置模板（key 为空占位），可再添加任意自定义中转站
- 📐 **8 种尺寸**：按 1K / 2K / 4K 分组展示，含正方形 / 横屏 / 竖屏
- 💾 **本地存图**：生成的图片全部保存到 IndexedDB，不依赖远端 URL；图片默认 base64 内联请求，避免二次 GET 延迟
- 📱 **PWA**：可"添加到主屏幕"像原生 App 一样全屏运行，离线可浏览历史
- 🔐 **CORS 代理**：自带同源 `/api/cors` Pages Function，无需额外 Worker；每个中转站独立开关
- 📋 **请求日志**：失败消息上点「查看请求详情」可看到完整请求 / 响应（headers、body、状态、错误类型），每个字段都有一键复制按钮，用于排查
- 🌐 **离线检测**：顶部横幅提示当前网络状态
- ⏱️ **请求超时兜底**：单次 API 调用超过 10 分钟自动中止；任何消息卡在「生成中」超过 5 分钟会被清扫为失败
- 🎯 **自动选择有效中转站**：新建对话时优先用已配 key 的中转站，避免落到未配置的内置项

---

## 技术栈

| 类别 | 选型 |
|------|------|
| 构建 | Vite 6 |
| 框架 | React 18 + TypeScript 5 |
| 样式 | Tailwind CSS 3 + shadcn/ui（Radix UI primitives） |
| 状态 | Zustand 4 |
| 持久化 | Dexie 4（IndexedDB 封装） |
| 路由 | React Router 6 |
| PWA | vite-plugin-pwa（Workbox） |
| HTTP | 原生 fetch + AbortController |
| 测试 | Vitest + Testing Library + MSW + fake-indexeddb |
| E2E | Playwright |

---

## 快速开始

### 环境要求

- Node.js 18+（推荐 20+）
- npm 9+ 或 pnpm 8+

### 安装与运行

```bash
# 克隆仓库
git clone <your-repo-url>
cd image2chat

# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 构建生产产物到 dist/
npm run build

# 本地预览构建产物
npm run preview
```

### 测试与代码检查

```bash
# 运行单元测试
npm test

# 监听模式
npm run test:watch

# TypeScript 类型检查
npm run lint

# 构建并验证
npm run build
```

---

## 使用说明

### 首次配置

首次启动 `App.tsx` 会自动把 Packy / RunAPI / uuapi 三个内置中转站写入 IndexedDB（均为空 key 占位）。进入主页后点空状态页中央的「**密钥管理**」按钮：

1. 在密钥管理抽屉里给任一中转站填入 SK 密钥（向对应中转站申请）
2. 可选：点「测试」通过 `GET /v1/models` 端点快速验证密钥（不消耗额度），结果会显示一个绿色「✓ 有效」或红色「✗ 无效」徽章
3. 展开「高级配置」可切换 CORS 代理（见下方）
4. 点「保存」关闭抽屉，主页空状态按钮变为「**新建对话**」

> 内置 Packy / RunAPI / uuapi 的 baseUrl 已预填，可直接使用；自定义中转站需手动填写域名（必填项）。

### 生成图片

1. 在左侧侧边栏点「新建对话」
2. 在底部输入框描述想要的图像，回车发送
3. 等待 10-60 秒，图片出现在对话中（消息下方会实时显示已耗时）
4. 点击图片查看大图，或在 ImageViewer 里点「保存」下载到设备

### 编辑图片（多张参考图）

底部输入框左侧有「上传参考图」按钮（也支持把图片直接拖到输入框）：

- **引用上一张图**：AI 消息右下角「编辑」按钮会把那张图自动加进 ref 条
- **本地图片**：上传的图直接进 ref 条
- **多张混用**：可同时引用多张 AI 图 + 多张本地图，**最多 3 张**
- **拖拽排序**：ref 条里长按拖动调整顺序
- 顺序就是请求里 `image[]` 的顺序
- 发送时根据 ref 数量自动走 `POST /v1/images/edits`，无 ref 则走 `POST /v1/images/generations`

### 切换中转站 / 尺寸

- 聊天页底部**状态条卡片**默认折叠为一个胶囊
- 点一下展开为浮层（在卡片上方弹出）：
  - 「中转站」一栏列出所有 provider，点选即切换当前会话的 provider；当前 provider 未配 key 时显示红色「未配置密钥」徽章
  - 「尺寸」一栏按 1K / 2K / 4K 分组，每个尺寸有缩略图预览，点选即修改默认尺寸
- 再次点状态条可折叠回胶囊
- 选 provider 时会立即把当前会话的 `providerPresetId` 切到新值（保存在 DB）

### 密钥管理

从右侧抽屉进入（点空状态页按钮 / 主页头部齿轮按钮 / 侧边栏相关入口）：

- ✏️ **编辑 Key**：修改已有中转站的密钥
- 🧪 **测试**：通过 `GET /v1/models` 端点快速验证密钥有效性（不消耗额度）；测试结果显示为带时间戳的徽章（✓ 有效 / ✗ 无效 · X 分钟前）
- 🌐 **CORS 代理**：在「高级配置」折叠区，二选一单选：
  - **直接连接**（默认）：直连目标服务器
  - **/api/cors**：走仓库自带的同源 Pages Function（见下方 CORS 章节）
- ➕ **添加自定义**：右上角「添加自定义」按钮，名称 + 域名（必填） + SK 密钥，可一次添加多条
- 🗑️ **删除**：仅非内置的中转站可删；内置 provider 永远在

> 抽屉里的所有改动先在内存里 draft，点底部「保存」才一次性原子写入 DB；中途关闭抽屉则全部丢弃。

### 请求日志（排查用）

任何失败的消息下方都有一个「**查看请求详情**」按钮（图标是剪贴板），点了打开对话框显示：

- 时间戳 + 耗时
- 中转站名 + baseUrl
- 模型、CORS 代理启用状态
- 完整请求 URL、方法
- **请求 Headers**（Authorization 自动脱敏为 `Bearer ***`）
- **请求 Body**（生成时是 JSON；编辑时显示图片摘要，因为 FormData 里的 blob 不便存）
- HTTP 状态码；网络异常时显示「网络异常（无响应）」
- 响应 Headers、响应 Body（如有）
- 错误类型 + 错误信息
- 关联的会话 / 消息 ID

每个字段右上角都有「**复制**」按钮，方便贴到 issue / 群里求助。

日志存储在 IndexedDB 的 `requestLogs` 表，只保留**最近 100 条**，超出自动清理（`pruneOldLogs`）。

---

## CORS 代理

部分中转站（典型如 RunAPI）未配置 `Access-Control-Allow-Origin` 头，浏览器 fetch 会被 CORS 策略拦截。**默认「直接连接」**——只有当某中转站真不通 CORS 时才在「密钥管理 → 高级配置」里切到 `/api/cors`。

仓库自带 `functions/api/cors.ts`（Cloudflare Pages Function），部署到 Cloudflare Pages 后自动挂在 `/api/cors`。本地开发（`npm run dev`）也已自动挂载同一条路径——`vite.config.ts` 里有个 dev-only 中间件走的是同一份 `handleCors()`（在 `functions/cors-shared.ts`），所以本地测试无 CORS 的中转站时不用额外配置。

> 应用**不再支持填自定义 CORS URL**（早期版本有过，已移除）。如确需代理到外部域名，把 `infra/cors-worker/` 里那个独立 Worker 模板部署后，**直接修改 `src/lib/api/corsConfig.ts`** 把 `corsValueFromDraft` 的 `'builtin'` 分支改成你的 worker URL，再重新构建。

行为说明（`src/lib/api/proxy.ts` 的 `applyCorsProxy`）：

- 「直接连接」→ `corsProxy` 为空 → 直连目标服务器
- 「/api/cors」→ `corsProxy` 为 `/api/cors` → 拼成 `/api/cors?url=<encoded>`
- 不同中转站可独立配置，互不影响
- 请求日志里 `corsProxyApplied: true/false` 会记录实际是否走了代理

---

## 部署

### 静态托管（推荐 Cloudflare Pages）

1. 把代码推到 GitHub
2. 登录 https://dash.cloudflare.com → Workers & Pages → Create application → Pages → Connect to Git
3. 选择仓库，配置：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. `functions/` 目录会被 Pages 自动识别，CORS 代理随站点同源上线

> 也可用 Vercel / Netlify / GitHub Pages，但 Pages Function 不会自动生效——需要把 `functions/api/cors.ts` 翻译成对应平台的等效实现，否则选了「/api/cors」会 404。

### 出 Android APK（可选）

部署完成后，可以用 [PWABuilder](https://www.pwa_builder.com) 把 PWA 打包成 APK：

1. 打开 PWABuilder，粘贴你的部署 URL
2. 等扫描通过
3. 选择 Package for Stores → Android
4. 填写 Package ID（如 `com.image2chat.app`）
5. 下载生成的 APK，传到手机安装

---

## 项目结构

```
image2chat/
├── functions/                          # Cloudflare Pages Functions（生产部署）
│   ├── api/cors.ts                     # /api/cors 入口
│   └── cors-shared.ts                  # handleCors 实现（vite dev 中间件也复用）
├── infra/
│   └── cors-worker/                    # 独立部署的 CORS Worker 模板（不再 UI 暴露）
├── src/
│   ├── main.tsx                        # React 入口
│   ├── App.tsx                         # 启动种子 + onboarding 守卫 + 路由
│   ├── routes.tsx                      # 路由表（/, /c/:id）
│   ├── test-setup.ts                   # Vitest 全局设置
│   ├── test/
│   │   ├── server.ts                   # MSW server
│   │   └── handlers.ts                 # MSW 请求 mock
│   ├── lib/
│   │   ├── db.ts                       # Dexie schema（providers, conversations, messages, images, requestLogs）
│   │   ├── repo.ts                     # 仓储层 CRUD + 级联删除 + 内置模板种子 + 5min stale 扫描
│   │   ├── image.ts                    # Blob ↔ ObjectURL 工具
│   │   ├── utils.ts                    # cn() 等通用工具
│   │   └── api/
│   │       ├── client.ts               # generateImage / editImageMulti（fetch + 10min AbortController + RequestLog 写入）
│   │       ├── errors.ts               # ApiError 判别联合 + HTTP→kind 映射
│   │       ├── proxy.ts                # applyCorsProxy（corsProxy 非空才包）
│   │       ├── providers.ts            # Packy/RunAPI/uuapi baseUrl + 8 种尺寸白名单
│   │       ├── validate.ts             # GET /v1/models 密钥校验
│   │       ├── corsConfig.ts           # 内置 provider 的 CORS 二选一 draft/value 转换
│   │       ├── types.ts                # 共享类型（GenerateRequest 等）
│   │       └── normalize.ts            # 响应字段归一化（b64 / data_url / url）
│   ├── stores/
│   │   ├── useSession.ts               # 当前 provider / 默认尺寸 / 主题
│   │   └── useSettings.ts              # SettingsSheet 开关状态
│   ├── hooks/
│   │   ├── useProviders.ts             # Dexie liveQuery
│   │   ├── useConversations.ts
│   │   ├── useMessages.ts
│   │   ├── useGenerate.ts              # 生成编排：API + DB + blob 下载
│   │   └── usePillToast.ts             # 顶部胶囊 toast 队列
│   ├── components/
│   │   ├── ui/                         # shadcn/ui 原子组件（button / sheet / dialog / toast / popover / dropdown 等）
│   │   ├── OnboardingWizard.tsx        # 兜底引导（仅在 seedBuiltinProviders 失败且 DB 为空时触发）
│   │   ├── Sidebar.tsx                 # 会话列表 + 状态着色 + 删除确认
│   │   ├── ChatView.tsx                # 消息流容器（按日期分组 + 锚定滚动 + 5min stale 局部扫描）
│   │   ├── MessageBubble.tsx           # 单条消息渲染（生成中 / 成功 / 失败 / 含查看请求详情）
│   │   ├── Composer.tsx                # 输入区 + 1-3 张参考图拖拽条
│   │   ├── StatusBar.tsx               # 折叠胶囊 + 展开后的浮层（中转站 / 尺寸分组）
│   │   ├── ParamSheet.tsx              # 尺寸选择面板（1K / 2K / 4K 分组 + 缩略图）
│   │   ├── SettingsSheet.tsx           # 密钥管理（右侧抽屉 + draft + 原子保存）
│   │   ├── RequestLogDetailsDialog.tsx # 请求日志查看对话框（每个字段可一键复制）
│   │   ├── PillToast.tsx               # 顶部胶囊 toast 渲染
│   │   ├── ImageViewer.tsx             # 全屏图片预览 + 保存
│   │   ├── OfflineBanner.tsx           # 离线提示横幅
│   │   └── ThemeToggle.tsx             # 浅色 / 深色切换
│   └── pages/
│       └── HomePage.tsx                # 主页（侧边栏 + 聊天 + 空状态 + 5min stale 全局扫描）
└── vite.config.ts                      # 含 /api/cors dev-only 中间件
```

---

## 已知限制

- ❌ **不支持流式响应**：API 不支持 stream；图片生成是单次 POST + 等待
- ❌ **不支持多设备同步**：数据存 IndexedDB，换设备/清缓存会丢
- ❌ **不自带失败重试**：失败的消息需手动重新发送（设计取舍：避免 token 重复消耗，且错误信息可直接看请求日志定位）
- ❌ **测试连接依赖 `/v1/models` 端点**：极少数中转站可能没实现该端点，会显示"该中转站不支持自动验证"
- ⚠️ **图片保存到「下载」目录**：浏览器默认行为；Android PWA 通过 Filesystem API 选择位置
- ⚠️ **密钥明文存 IndexedDB**：浏览器内任何 JS 都可读取，与 localStorage 同等风险；适合个人使用，不要在共享设备上保存密钥

---

## 路线图

未来可能加入的功能（按优先级）：

- [ ] 一键重试（基于 RequestLog 复用 body）
- [ ] 会话导出 / 导入（JSON）
- [ ] Cloudflare R2 / Supabase 多设备同步
- [ ] i18n（英文支持）
- [ ] 桌面小组件（快速出图）

---

## 开发约定

- 包名：`com.image2chat.app`
- 端口：开发 5173，预览 4173
- 路径别名：`@/*` → `src/*`
- 默认 size：`2048x1152`（2K 横向）
- 固定参数：`model=gpt-image-2`、`n=1`、`quality=high`、`response_format=b64_json`、`moderation=low`
- 请求超时：`TIMEOUT_MS = 600_000`（10 分钟，`src/lib/api/client.ts`）
- 失败清扫：消息卡在 `generating` 超过 `5 * 60 * 1000` ms（5 分钟）会被标记 failed，扫两处：HomePage 全局 + ChatView 局部
- 参考图上限：`MAX_REFS = 3`（`src/pages/HomePage.tsx` 和 `src/components/Composer.tsx` 都有一份）
- 提交规范：Conventional Commits（`feat` / `fix` / `docs` / `refactor` / `test` / `chore`），scope 通常是模块名（`settings` / `home` / `ui` 等）

---

## License

MIT