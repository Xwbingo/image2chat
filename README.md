# image2chat

一款基于 Web 的 AI 图像生成聊天应用，支持多家中转站（Packy / RunAPI / 自定义），可在浏览器或作为 PWA 安装到手机使用。

> 通过 OpenAI 兼容的 `gpt-image-2` 模型，支持**文生图**和**图片编辑**两种模式，会话数据全部本地存储（IndexedDB），不上云。

---

## 主要功能

- 🎨 **文生图**：输入文字描述生成图片
- ✏️ **图片编辑**：上传参考图 + 文字描述进行二次创作
- 💬 **多轮会话**：聊天窗口风格 UI，会话历史完整保留
- 🔌 **多中转站**：内置 Packy / RunAPI 预设，可添加任意自定义中转站
- 📐 **7 种尺寸**：从 1024² 到 4K 横竖屏
- 💾 **本地存图**：生成的图片全部保存到 IndexedDB，不依赖远端 URL
- 🔁 **失败重试**：5xx / 网络错误可一键重试，401 直接跳转密钥管理
- 📱 **PWA**：可"添加到主屏幕"像原生 App 一样全屏运行，离线可浏览历史
- 🔐 **CORS 代理**：对不支持浏览器直连的中转站，可配置 Cloudflare Worker 等代理
- 🌐 **离线检测**：顶部横幅提示当前网络状态
- ⏱️ **超时兜底**：生成中超过 5 分钟的消息自动标记失败

---

## 技术栈

| 类别 | 选型 |
|------|------|
| 构建 | Vite 5 |
| 框架 | React 18 + TypeScript 5 |
| 样式 | Tailwind CSS 3 + shadcn/ui（Radix UI primitives） |
| 状态 | Zustand 4 |
| 持久化 | Dexie 4（IndexedDB 封装） |
| 路由 | React Router 6 |
| PWA | vite-plugin-pwa（Workbox） |
| HTTP | 原生 fetch + AbortController |
| 测试 | Vitest + Testing Library + MSW + fake-indexeddb |

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

启动应用后会进入引导流程：

1. 选择中转站模板（**Packy** / **RunAPI** / **自定义**）
2. 输入你的 SK 密钥（向对应中转站申请）
3. 点击「完成」进入聊天页

> 内置 Packy / RunAPI 的 baseUrl 已预填，可直接使用；自定义中转站需手动填写域名。

### 生成图片

1. 在左侧侧边栏点「新建对话」
2. 在底部输入框描述想要的图像，回车发送
3. 等待 10-60 秒，图片出现在对话中
4. 点击图片查看大图，或点「保存」下载到设备

### 编辑图片

两种方式进入编辑模式：

- **引用上一张图**：点击 AI 生成的图片右下角「编辑」按钮，输入新描述即可基于该图修改
- **上传新图片**：点击输入框左侧的回形针按钮，从相册或相机选择图片

### 切换中转站 / 尺寸

- 聊天页底部状态条左侧「当前：xxx ▾」切换中转站
- 右侧「尺寸：xxx ▾」选择图像尺寸（默认 2K 横向 2048×1152）

### 密钥管理

进入「密钥管理」页面（侧边栏底部 / 空状态页按钮）：

- ✏️ **编辑 Key**：修改已有中转站的密钥
- 🧪 **测试**：通过 `GET /v1/models` 端点快速验证密钥有效性（不消耗额度）
- 🌐 **CORS 代理**：可选，配置后所有请求经代理转发（详见下方）
- ➕ **添加自定义**：新增中转站
- 🗑️ **删除**：仅删除非内置的中转站

### CORS 代理（高级）

部分中转站（如 RunAPI）未配置 `Access-Control-Allow-Origin` 头，浏览器 fetch 会被 CORS 策略拦截。解决：

1. 部署一个 Cloudflare Worker（推荐，10 万次/天免费）
2. 在「密钥管理」对应中转站的「CORS 代理」字段填入 worker URL，例如：

   ```
   https://your-proxy.workers.dev/?
   ```

3. 应用会自动把所有请求通过代理转发，请求会自动追加 `?url=<encoded>` 后缀

**Cloudflare Worker 示例代码**（5 行核心逻辑，30 秒完成）：

```javascript
export default {
  async fetch(request) {
    const target = new URL(request.url).searchParams.get('url');
    if (!target) return new Response('Missing ?url=', { status: 400 });
    const resp = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    const h = new Headers(resp.headers);
    h.set('Access-Control-Allow-Origin', '*');
    return new Response(resp.body, { status: resp.status, headers: h });
  },
};
```

---

## 部署

### 静态托管（推荐 Cloudflare Pages）

1. 把代码推到 GitHub
2. 登录 https://dash.cloudflare.com → Workers & Pages → Create application → Pages → Connect to Git
3. 选择仓库，配置：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 部署完成会得到一个 `*.pages.dev` 域名

> 也可用 Vercel / Netlify / GitHub Pages，配置相同。

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
src/
├── main.tsx                    # React 入口
├── App.tsx                     # 路由 + 启动种子
├── routes.tsx                  # 路由表
├── lib/
│   ├── db.ts                   # Dexie schema（providers, conversations, messages, images）
│   ├── repo.ts                 # 仓储层 CRUD + 级联删除 + 种子内置模板
│   ├── image.ts                # Blob ↔ ObjectURL 工具
│   ├── api/
│   │   ├── client.ts           # generateImage / editImage（fetch + AbortController）
│   │   ├── errors.ts           # ApiError 判别联合 + HTTP→kind 映射
│   │   ├── proxy.ts            # CORS 代理 URL 包装
│   │   ├── providers.ts        # Packy/RunAPI baseUrl + 尺寸白名单
│   │   └── validate.ts         # GET /v1/models 密钥校验
│   └── test/
│       └── server.ts           # MSW server
├── stores/
│   └── useSession.ts           # Zustand 全局 session（当前 provider、默认尺寸）
├── hooks/
│   ├── useProviders.ts         # Dexie liveQuery
│   ├── useConversations.ts
│   ├── useMessages.ts
│   └── useGenerate.ts          # 生成编排：API + DB + blob 下载
├── components/
│   ├── ui/                     # shadcn/ui 原子组件
│   ├── OnboardingWizard.tsx    # 首次配置向导
│   ├── Sidebar.tsx             # 会话列表 + 抽屉
│   ├── ChatView.tsx            # 消息流容器
│   ├── MessageBubble.tsx       # 单条消息渲染（4 种状态）
│   ├── Composer.tsx            # 输入区 + 图片上传
│   ├── StatusBar.tsx           # provider + size 切换
│   ├── ParamSheet.tsx          # 尺寸选择面板（分组：常规 / 2K / 4K）
│   ├── ProviderSheet.tsx       # 中转站切换面板
│   ├── ImageViewer.tsx         # 全屏图片预览 + 保存 / 复制
│   └── OfflineBanner.tsx       # 离线提示
└── pages/
    ├── HomePage.tsx            # 主页（侧边栏 + 聊天）
    └── SettingsPage.tsx        # 密钥管理
```

---

## 已知限制

- ❌ **不支持多张参考图编辑**：API 单张限制（spec §1.3）
- ❌ **不支持流式响应**：API 不支持 stream
- ❌ **不支持多设备同步**：数据存 IndexedDB，换设备/清缓存会丢
- ❌ **RunAPI 等部分中转站需要 CORS 代理**：浏览器安全策略限制，需要自建 Cloudflare Worker 解决
- ❌ **测试连接依赖 `/v1/models` 端点**：极少数中转站可能没实现该端点，会显示"该中转站不支持自动验证"
- ⚠️ **图片保存到「下载」目录**：浏览器默认行为；Android PWA 通过 Filesystem API 选择位置
- ⚠️ **密钥明文存 IndexedDB**：浏览器内任何 JS 都可读取，与 localStorage 同等风险；适合个人使用，不要在共享设备上保存密钥

---

## 路线图

未来可能加入的功能（按优先级）：

- [ ] 多张参考图编辑（API 支持后）
- [ ] 图片风格预设（胶片、动漫等）
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
- 固定参数：`model=gpt-image-2`、`n=1`、`quality=high`、`response_format=b64_json`（不再用 url，避免二次 GET 延迟）

---

## License

MIT