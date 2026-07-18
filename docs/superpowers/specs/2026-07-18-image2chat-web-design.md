# image2chat Web (PWA) 设计文档

- 日期：2026-07-18
- 交付形态：PWA（Vite 静态构建）→ 部署到 Vercel → 通过 [PWABuilder](https://www.pwa_builder.com) 打包为 Android APK
- 浏览器目标：Android Chrome 16+（含 PWA 安装）、桌面 Chrome/Firefox/Safari 最新版

## 1. 目标与范围

### 1.1 目标

打造一款 PWA 应用，可在 Android 16 桌面以原生 App 形态启动，也可在桌面浏览器使用。用户首次访问输入中转站域名与 SK 密钥后，可选择不同供应商，通过聊天窗口风格界面调用 `gpt-image-2` 生成或编辑图片，并保留多轮对话历史。

### 1.2 范围（MVP）

- 文本生成图片（`POST {baseUrl}/v1/images/generations`）
- 图片编辑（`POST {baseUrl}/v1/images/edits`，单张参考图）
- 多会话管理（侧边栏列表）
- 多供应商预设（可保存多套，聊天顶部快速切换）
- 图片预览、保存到设备（Filesystem API / `<a download>`）、复制 prompt
- 失败重试
- PWA：manifest + Service Worker（离线浏览历史）
- 通过 PWABuilder 输出 Android APK

### 1.3 不在 MVP 范围

- 多张参考图编辑
- 流式响应
- 云端账号同步
- 多设备同步
- 多语言 / 完整 i18n
- iOS 原生 App（PWA 在 iOS 也可装，但不在此验证）
- 多套编辑参数（仅尺寸可调）

## 2. 技术栈与架构

### 2.1 架构选型

单页 React SPA + Zustand 状态管理 + Dexie（IndexedDB 包装）持久化。PWA 通过 `vite-plugin-pwa`（Workbox）启用。

**选型理由**：
- 单人开发 + MVP 规模，React 生态成熟、组件复用高
- Zustand 比 Redux Toolkit 轻，状态逻辑简单时几行代码搞定
- Dexie `liveQuery` 让 IndexedDB 变更自动驱动 React 重渲染，省去手写缓存失效
- shadcn/ui 源码进项目，主题灵活，符合"漂亮 UI"诉求

### 2.2 项目结构

```
image2chat/
├── index.html
├── package.json
├── vite.config.ts              # vite-plugin-pwa、路径别名
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── components.json             # shadcn 配置
├── public/
│   ├── manifest.webmanifest
│   ├── icons/                  # 192/512/maskable
│   └── favicon.svg
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── lib/
    │   ├── db.ts               # Dexie schema + 类型
    │   ├── api/
    │   │   ├── types.ts
    │   │   ├── client.ts       # fetch 包装 + Auth
    │   │   ├── errors.ts       # ApiError 判别联合 + 解析
    │   │   └── providers.ts    # PACKY/RUNAPI/CUSTOM 配置
    │   ├── image.ts            # Blob ↔ ObjectURL
    │   └── utils.ts            # cn() 等
    ├── stores/
    │   ├── useSession.ts       # 当前 provider、当前尺寸
    │   └── useToast.ts
    ├── hooks/
    │   ├── useConversations.ts # Dexie liveQuery
    │   ├── useMessages.ts
    │   └── useProviders.ts
    ├── components/
    │   ├── ui/                 # shadcn 组件
    │   ├── ChatView.tsx
    │   ├── MessageBubble.tsx
    │   ├── Composer.tsx
    │   ├── StatusBar.tsx
    │   ├── ParamSheet.tsx
    │   ├── ProviderSheet.tsx
    │   ├── ImageViewer.tsx
    │   ├── Sidebar.tsx
    │   └── OnboardingWizard.tsx
    ├── pages/
    │   ├── HomePage.tsx
    │   └── SettingsPage.tsx
    ├── routes.tsx
    └── styles/globals.css      # Tailwind base + CSS 变量
```

### 2.3 关键技术

| 类别 | 选型 |
|------|------|
| 构建 | Vite 5 |
| 框架 | React 18 + TypeScript 5 |
| 路由 | React Router 6 |
| 样式 | Tailwind CSS 3 + shadcn/ui（Radix UI primitives） |
| 状态 | Zustand 4 |
| 持久化 | Dexie 4（IndexedDB） |
| PWA | vite-plugin-pwa（Workbox） |
| 网络 | 原生 fetch + AbortController |
| 测试 | Vitest + @testing-library/react + fake-indexeddb + MSW |
| 工具 | date-fns、clsx、tailwind-merge |

## 3. 数据模型

### 3.1 Dexie Schema

```ts
// lib/db.ts
export type ProviderType = 'packy' | 'runapi' | 'custom'

export interface ProviderPreset {
  id?: number
  name: string
  baseUrl: string
  apiKey: string                // 明文存储（浏览器内统一约定）
  type: ProviderType
  isBuiltIn: 0 | 1
  createdAt: number
}

export interface Conversation {
  id?: number
  title: string
  createdAt: number
  updatedAt: number
  providerPresetId: number
}

export type MessageRole = 'user' | 'assistant'
export type MessageKind = 'text_prompt' | 'image_result' | 'image_edit_request'
export type MessageStatus = 'pending' | 'generating' | 'success' | 'failed'

export interface Message {
  id?: number
  conversationId: number
  role: MessageRole
  kind: MessageKind
  prompt?: string
  imageBlobId?: number         // FK → images.id
  remoteImageUrl?: string      // 兜底
  size?: string                // "2048x1152"
  status: MessageStatus
  errorCode?: string
  createdAt: number
}

export interface ImageBlob {
  id?: number
  blob: Blob
  mimeType: string
  createdAt: number
}

class Image2ChatDB extends Dexie {
  providers!: Table<ProviderPreset, number>
  conversations!: Table<Conversation, number>
  messages!: Table<Message, number>
  images!: Table<ImageBlob, number>

  constructor() {
    super('image2chat')
    this.version(1).stores({
      providers:     '++id, type, createdAt',
      conversations: '++id, updatedAt, providerPresetId',
      messages:      '++id, conversationId, createdAt, status',
      images:        '++id, createdAt',
    })
  }
}

export const db = new Image2ChatDB()
```

要点：
- 所有生成图片**本地落盘**为 `images.blob`；UI 显示时用 `URL.createObjectURL(blob)`，组件卸载时 `revokeObjectURL`
- `Message.imageBlobId` 关联；`remoteImageUrl` 仅作兜底
- 用户上传编辑用的图片也存 `images` 表
- 内置 provider 用 `isBuiltIn=1`，不可删

### 3.2 localStorage

| key | 类型 | 用途 |
|-----|------|------|
| `i2c.activeProviderId` | number | 当前激活 provider 的 id |
| `i2c.defaultSize` | string | "2048x1152" |

不存 API Key（与 IndexedDB 同等风险，统一在 Dexie）。

### 3.3 生成参数默认值

| 参数 | 默认值 | 是否暴露 UI |
|------|--------|-------------|
| model | `gpt-image-2` | 否 |
| n | `1` | 否 |
| quality | `high` | 否 |
| response_format | `url` | 否 |
| size | `2048x1152` | 是（7 选 1） |
| output_format | 不传 | 否 |
| user | 设备 ID | 否 |

可选尺寸：

| 显示名 | 像素 |
|--------|------|
| 1:1 | 1024x1024 |
| 横向 | 1536x1024 |
| 纵向 | 1024x1536 |
| 2K 正方形 | 2048x2048 |
| **2K 横向（默认）** | 2048x1152 |
| 4K 横向 | 3840x2160 |
| 4K 纵向 | 2160x3840 |

## 4. UI 流程

### 4.1 路由

```
/                       → OnboardingWizard（若无 provider）或 HomePage
/c/:conversationId      → HomePage（嵌套 ChatView）
/settings               → SettingsPage
```

### 4.2 OnboardingWizard

触发条件：`db.providers.count() === 0`。

三步走，**只在首次访问出现**：

1. 欢迎页：大标题 + "开始使用"
2. 选择模板：PACKY / RUNAPI 预填卡片 + "自定义"按钮
3. 输入 Key：单输入框（type=password）+ "完成"

保存成功后 navigate `/`；已存在 provider 时该路由不渲染。

### 4.3 HomePage

**桌面（≥768px）**：固定 260px 侧边栏 + 右侧主区  
**手机（<768px）**：汉堡菜单触发 Sheet 抽屉

侧边栏：
- 顶部 "新建对话" 按钮
- 会话列表（按 `updatedAt` 倒序）：缩略图 + 标题 + 相对时间
- 长按：重命名 / 删除
- 底部：当前 provider 名称（仅展示）

主区：
- 已选会话 → ChatView
- 未选 → 空态

### 4.4 ChatView

```
┌──────────────────────────────────────┐
│ ← 会话标题          ⋮ (菜单)         │ Top bar
├──────────────────────────────────────┤
│                                      │
│   [用户气泡：prompt + 可选图]        │ 右对齐
│                                      │
│   ┌────────────────┐                │
│   │  AI 生成图       │                │ 左对齐圆角卡片
│   │  [保存] [编辑]   │                │ 仅 SUCCESS
│   └────────────────┘                │
│                                      │
│   [骨架屏 + "正在创作…"]             │ GENERATING
│                                      │
├──────────────────────────────────────┤
│ [📎] 输入框...            [发送]    │
│ 当前: Packy ▾    尺寸: 2K 横向 ▾    │ 状态条
└──────────────────────────────────────┘
```

关键交互：

1. **发送**  
   纯文字 → 插 `user` + `assistant` 占位 → 调 `generateImage`  
   编辑模式 → 插 `user` 编辑消息 → 调 `editImage`

2. **"编辑此图"**  
   AI 卡片 [编辑] → 输入区切编辑模式（顶部已选图缩略图 + ✕）  
   输新 prompt → 调 `editImage`

3. **点击图片**  
   `Dialog` 全屏预览 + 滚轮缩放  
   操作：[保存到设备] [复制 prompt]

4. **失败**  
   红框 + ⚠ + 文案 + 主操作按钮（重试 / 去设置 / 我知道了）

5. **参数面板**  
   `⋮` → Dialog 弹尺寸 7 选 1

6. **Provider 切换**  
   状态条左 → Dialog 列全部 preset，选中即切换

### 4.5 SettingsPage

- Provider 列表卡片（名称、域名、类型徽标）
- 每行：[编辑 Key] [删除]（内置不可删）
- 顶部 [添加自定义]

### 4.6 多轮"上下文"语义

- UI 保留完整聊天历史
- "编辑上一张图"显式把上一张图作为参考
- **不**向 API 发送历史 prompt（中转站 API 不支持）

## 5. 网络层

### 5.1 API 端点

```
POST {baseUrl}/v1/images/generations   # JSON
POST {baseUrl}/v1/images/edits         # multipart/form-data
```

### 5.2 DTO

```ts
export interface GenerateRequest {
  model?: string                  // 'gpt-image-2'
  prompt: string
  n?: number                      // 1
  size: string                    // '2048x1152'
  quality?: string                // 'high'
  response_format?: 'url' | 'b64_json'
  user?: string
}

export interface GenerateResponse {
  created: number
  data: Array<{
    url?: string
    b64_json?: string
    revised_prompt?: string
  }>
}
```

### 5.3 客户端

```ts
// lib/api/client.ts
export async function generateImage(
  baseUrl: string, apiKey: string, req: GenerateRequest
): Promise<GenerateResponse>

export async function editImage(
  baseUrl: string, apiKey: string,
  prompt: string, sourceBlob: Blob, size: string
): Promise<GenerateResponse>
```

实现细节：
- 原生 `fetch` + `AbortController`（120s 超时）
- `Authorization: Bearer <apiKey>`
- `editImage` 用 `FormData`，附图字段名 `image`
- dev 模式 `console.log` 请求/响应，prod 关

### 5.4 Provider 配置

```ts
// lib/api/providers.ts
export const BUILTIN_PROVIDERS = {
  packy:  { name: 'Packy',  baseUrl: 'https://www.packyapi.com' },
  runapi: { name: 'RunAPI', baseUrl: 'https://runapi.co' },
} as const

export function getSupportedSizes(type: ProviderType): string[] {
  if (type === 'runapi') {
    return ['1024x1024','1536x1024','1024x1536','2048x2048','2048x1152']
  }
  return ['1024x1024','1536x1024','1024x1536','2048x2048','2048x1152','3840x2160','2160x3840']
}
```

### 5.5 CORS 假设

MVP 假设两个中转站允许浏览器直连。**如果某个拒绝 CORS**，MVP 之外加 Node.js 代理服务器。当前不构建代理。

### 5.6 错误模型

```ts
// lib/api/errors.ts
export type ApiError =
  | { kind: 'unauthorized';       message: string }
  | { kind: 'insufficient';       message: string }
  | { kind: 'rate_limited';       message: string }
  | { kind: 'content_filtered';   message: string }
  | { kind: 'bad_request';        message: string }
  | { kind: 'server_error';       message: string }
  | { kind: 'network';            message: string }

export function parseApiError(response: Response, body?: string): ApiError
export function parseNetworkError(e: unknown): ApiError
```

| HTTP | kind |
|------|------|
| 401 | unauthorized |
| 402 | insufficient |
| 429 | rate_limited |
| 400 | bad_request（提取 `body.error.message`） |
| 200 + `data:[]` | content_filtered |
| 500–599 | server_error |
| fetch 异常 | network |

## 6. 错误处理 UX

### 6.1 状态机

```
[PENDING] ─发送─▶ [GENERATING] ─200─▶ [SUCCESS]
                       │
                       ├─HTTP error──▶ [FAILED + ApiError]
                       └─Timeout/IO──▶ [FAILED + network]
```

| 状态 | 用户气泡 | AI 气泡 |
|------|---------|---------|
| PENDING | 小菊花 | — |
| GENERATING | 灰色"已发送" | 骨架屏 + Spinner + 文案（4s 切换） |
| SUCCESS | 正常 | 图片卡 + [保存] [编辑] |
| FAILED | 不变 | 红边 + ⚠ + 主操作按钮 |

### 6.2 主操作按钮

| 错误类型 | 按钮 | 动作 |
|----------|------|------|
| 5xx / network / 429 | **重试** | 复用 prompt + 参数重发 |
| 401 | **去设置更新密钥** | 跳 `/settings` |
| 402 / content_filtered / 其他 4xx | **我知道了** | 关闭提示 |

### 6.3 全局兜底

- 未配置 provider 进 `/c/:id` → redirect `/`
- `navigator.onLine === false` → 顶部黄色 Banner
- 生成中关闭页面 → 重新打开时若 `createdAt < now - 5min` 且仍 `generating` → 自动标 `failed`，文案"已中断，点击重试"

### 6.4 输入校验

- prompt `trim()` 非空
- 编辑模式必须有附图
- prompt 长度 ≤ 4000 字符
- 附图 >10MB → Toast 拒绝

## 7. PWA 配置

### 7.1 manifest

```json
{
  "name": "image2chat",
  "short_name": "image2chat",
  "description": "AI 图像生成聊天",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0f172a",
  "theme_color": "#6750a4",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 7.2 Service Worker

`vite-plugin-pwa` + Workbox：
- `registerType: 'autoUpdate'`
- `workbox.runtimeCaching` 规则：
  - 中转 API：**NetworkOnly**（生成图必须实时调，不缓存）
  - 应用静态资源：**precache + StaleWhileRevalidate**
- 离线时仍可访问已加载的会话（IndexedDB）

### 7.3 部署 → APK 流程

1. `npm run build` 产出 `dist/`
2. 部署到 Vercel（GitHub 登录，零配置）
3. 打开 https://www.pwa_builder.com，贴部署 URL
4. "Package for Stores → Android" → 下载 APK / AAB
5. 用户在 Android Chrome 打开部署 URL，点 "添加到主屏幕" 也可获得类原生体验

## 8. 测试

| 层 | 工具 | 重点 |
|----|------|------|
| 单元 | Vitest | `errors.ts`、`image.ts`、Zustand stores |
| Hook | @testing-library/react + fake-indexeddb | `useConversations`、`useMessages` |
| 组件 | @testing-library/react + Vitest jsdom | MessageBubble 状态映射、ParamSheet |
| 网络 | MSW | generateImage/editImage 响应解析 |
| E2E（可选）| Playwright | onboarding → 生成 → 重试 |

**黄金路径**：MSW 拦截 `www.packyapi.com`，返回固定 base64 PNG，跑通"输入 prompt → 看到图片 → 保存到设备"。

不在 MVP：覆盖率门槛、性能基准、i18n。

## 9. 关键风险与决策记录

- **多轮上下文 ≠ API 上下文**：API 不支持连续多轮 prompt，"上下文"仅 UI 历史。
- **API Key 明文存 IndexedDB**：浏览器内无论 localStorage 还是 IndexedDB 都能在控制台被同源脚本读取；统一存 IndexedDB 便于事务管理。
- **CORS 假设**：假设两个中转站允许浏览器直连；若不通过需新增 Node.js 代理（不在 MVP）。
- **PWABuilder 出 APK**：用户对"原生 APK"的最低成本路径。不构建自定义 Android 工程。
- **Workbox 不缓存中转 API**：生成图必须实时调，不缓存。
- **图片本地落盘为 Blob**：避免远端 URL 过期。
- **生成中关闭页面 → 自动失败**：避免幽灵消息永远处于 `generating`。

## 10. 后续扩展（不在 MVP）

- Node.js CORS 代理（如果中转站拒绝浏览器直连）
- 多张参考图编辑
- 图片风格预设（胶片、动漫等）
- 会话导出/导入（JSON）
- i18n
- Cloudflare R2 / Supabase Storage 多设备同步
- 应用快捷方式（长按图标 → "新建对话"）