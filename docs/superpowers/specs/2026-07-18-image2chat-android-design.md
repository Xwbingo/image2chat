# image2chat Android 设计文档

- 日期：2026-07-18
- 目标平台：Android 16（minSdk 26, targetSdk 36）
- 技术栈：Kotlin + Jetpack Compose + Material 3 + Hilt + Retrofit + Room

## 1. 目标与范围

### 1.1 目标

打造一款 Android 原生 AI 图像生成聊天应用。用户首次使用输入中转站域名与 SK 密钥后可选择不同供应商，通过聊天窗口风格界面调用 `gpt-image-2` 模型生成或编辑图片，并保留多轮对话历史。

### 1.2 范围（MVP）

- 文本生成图片（`POST /v1/images/generations`）
- 图片编辑（`POST /v1/images/edits`，单张参考图）
- 多会话管理（侧边栏列表）
- 多供应商预设（可保存多套，聊天顶部快速切换）
- 图片预览、保存到相册、分享
- 失败重试

### 1.3 不在 MVP 范围

- 多张参考图编辑（API 单张限制）
- 流式响应（API 不支持）
- 云端账号同步
- WorkManager 后台重试
- 多语言 / 完整国际化
- iOS 端

## 2. 架构

### 2.1 架构选型

单模块 `:app` + MVVM + Repository，按 `data / domain / ui` 分包隔离。

推荐理由：单人开发、MVP 规模，单模块构建快；分包边界清晰便于后续演进；需要时再拆 `:data :domain :ui` 三模块。

### 2.2 模块结构

```
app/
├── data/
│   ├── api/           Retrofit 接口 + Provider 适配器
│   ├── db/            Room：Conversation / Message / Attachment / ProviderPreset
│   ├── prefs/         DataStore：当前选中 providerId、UI 偏好
│   └── repo/          ConversationRepository, ProviderRepository, GenerationRepository
├── domain/
│   ├── model/         Conversation, Message, ImageSize, GenerationParams
│   └── usecase/       GenerateImage, EditImage, ManageProviders（薄封装）
├── ui/
│   ├── onboarding/    首次启动：选择 / 添加 provider
│   ├── home/          侧边栏 + 会话列表
│   ├── chat/          主聊天界面（消息流 + 输入区 + 进度）
│   ├── settings/      provider 管理、参数面板
│   ├── viewer/        全屏图片预览组件（基于 Dialog）
│   └── theme/         Material 3 主题（深色优先 / 动态取色）
└── di/                Hilt 模块
```

### 2.3 关键技术

- DI：Hilt
- 网络：Retrofit + OkHttp + Moshi
- 持久化：Room + DataStore（密钥用 Tink 加密）
- 异步：Coroutines + Flow
- 图片：Coil
- 导航：Navigation Compose
- 权限：Accompanist Permissions

## 3. 数据模型

### 3.1 ProviderPreset

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long (PK) | 自增 |
| name | String | 用户别名 |
| baseUrl | String | 仅域名，不含路径 |
| apiKey | String | Bearer token，**Tink 加密**后存 DataStore |
| type | Enum | `PACKY` / `RUNAPI` / `CUSTOM` |
| isBuiltIn | Boolean | 内置不可删 |
| createdAt | Long | epoch ms |

### 3.2 Conversation

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long (PK) | 自增 |
| title | String | 默认取首条 prompt 前 20 字 |
| createdAt / updatedAt | Long | epoch ms |
| providerPresetId | Long (FK) | 当前会话绑定的 provider |

### 3.3 Message

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long (PK) | 自增 |
| conversationId | Long (FK) | |
| role | Enum | `USER` / `ASSISTANT` |
| kind | Enum | `TEXT_PROMPT` / `IMAGE_RESULT` / `IMAGE_EDIT_REQUEST` |
| prompt | String? | 用户文字 |
| imageLocalPath | String? | 用户上传 / AI 生成的本地路径 |
| remoteImageUrl | String? | API 返回 URL，兜底用 |
| size | String? | 例 `2048x1152` |
| status | Enum | `PENDING` / `GENERATING` / `SUCCESS` / `FAILED` |
| errorCode | String? | 见 §6 |
| createdAt | Long | epoch ms |

要点：
- 所有生成图片**本地落盘**（`context.filesDir/generated/<messageId>.png`），`imageLocalPath` 必有
- `IMAGE_EDIT_REQUEST`：USER 角色且 `imageLocalPath` 非空，表示"用这张图编辑"
- 不向 API 发送历史上下文（中转站 API 不支持连续多轮 prompt）

### 3.4 UI 状态

```
ConversationRepository.observeMessages(convId): Flow<List<MessageUi>>

MessageUi (sealed):
  - UserTextBubble(text, attachedImagePath?)
  - UserEditRequestBubble(text, sourceImagePath)
  - AssistantImageBubble(localPath, remoteUrl?, status, error?)
  - AssistantGeneratingPlaceholder(size)
  - AssistantFailedBubble(error, retryAction)
```

### 3.5 生成参数默认值

| 参数 | 默认值 | 是否暴露 UI |
|------|--------|-------------|
| model | `gpt-image-2` | 否 |
| n | `1` | 否 |
| quality | `high` | 否 |
| responseFormat | `url` | 否 |
| size | `2048x1152` | 是（7 选 1） |
| outputFormat | 不传 | 否 |
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

### 4.1 屏幕清单

单 Activity + Compose Navigation：

```
NavGraph:
├── onboarding (startDestination if no provider)
├── home (会话列表抽屉)
└── chat/{conversationId}
```

辅助：全屏图片预览以 `Dialog` 实现，不进 NavGraph。

### 4.2 Onboarding

触发条件：本地无任何 `ProviderPreset`。

三步走：

1. 欢迎页（logo + "开始使用"）
2. 选择模板：卡片展示 `Packy` / `RunAPI` 两个内置模板，域名预填 → 输入 Key
3. 手动添加：底部"自定义" → 表单（名称、域名、Key、类型）

顶部进度条 `Step n / 3`。任一 provider 写入成功后跳转 Home。

### 4.3 Home

布局参考 ChatGPT Android：左侧抽屉 + 主区域。

抽屉内容：
- 顶部："新建对话" 按钮
- 中部：会话列表，按 `updatedAt` 倒序；每项展示首张缩略图 + 标题 + 相对时间
- 长按：重命名 / 删除
- 底部：当前 Provider 名称（仅展示，不可点击；切换入口在 Chat 底部状态条）

主区域：
- 已选会话 → 跳 Chat
- 未选 → 空态"开始一次新的创作"

### 4.4 Chat

布局：

```
┌─────────────────────────────────┐
│ ←  会话标题        ⋮ (菜单)     │  TopAppBar：菜单含参数、改名、清空
├─────────────────────────────────┤
│                                 │
│   [用户气泡：prompt + 可选图]   │  右对齐
│                                 │
│   ┌───────────────┐             │
│   │  AI 生成图      │             │  左对齐圆角卡片
│   │  [保存][编辑]   │             │  仅 SUCCESS 状态显示
│   └───────────────┘             │
│                                 │
│   [生成中：骨架 + 进度文案]       │  PENDING / GENERATING
│                                 │
├─────────────────────────────────┤
│ [📎] 输入框...           [发送] │  常态输入
│                                 │  编辑模式：上方出现已选图缩略图 + ✕
│ 当前供应商: Packy ▾   尺寸: 2K ▾ │  状态条
└─────────────────────────────────┘
```

关键交互：

1. **发送消息**
   - 纯文字 → 插入 `UserTextBubble` + `AssistantGeneratingPlaceholder`
   - 有附图 → 插入 `UserEditRequestBubble`
   - 调用 `GenerationRepository.generate()` 订阅状态更新

2. **"编辑此图"**
   - 点击 AI 图卡片 [编辑] → 输入区切换编辑模式（顶部出现已选图缩略图 + ✕）
   - 输入新 prompt → 发送，调用 `/v1/images/edits`

3. **点击图片**
   - 全屏预览（双指缩放）
   - 顶部操作：[保存到相册] [分享] [复制 prompt]

4. **生成失败**
   - 气泡内显示 ⚠ + 错误文案 + [重试]

5. **参数面板**
   - TopAppBar "⋮" → "参数设置" → BottomSheet
   - 尺寸 7 选 1，默认 `2048x1152`
   - 切换不重发，仅影响后续发送

6. **底部状态条**
   - 左：`当前供应商 ▾` → 底部菜单列出全部 preset，选中即切换（同步更新当前会话的 providerPresetId）
   - 右：`尺寸 ▾` → 同菜单逻辑
   - 任一供应商 Key 为空时，左侧显示 ⚠ 图标 + 提示去设置补全

7. **多轮"上下文"语义**
   - UI 保留完整聊天历史
   - 用户用"编辑上一张图"显式把上一张图作为参考
   - 不向 API 发送历史 prompt

## 5. 网络层

### 5.1 Retrofit 接口

```kotlin
interface ImageApi {
    @POST("v1/images/generations")
    suspend fun generate(@Body req: GenerateRequest): GenerateResponse

    @Multipart
    @POST("v1/images/edits")
    suspend fun edit(@Part parts: List<MultipartBody.Part>): EditResponse
}

data class GenerateRequest(
    val model: String = "gpt-image-2",
    val prompt: String,
    val n: Int = 1,
    val size: String,
    val quality: String = "high",
    val response_format: String = "url",
    val user: String? = null,
)

data class ImageResponse(
    val created: Long,
    val data: List<ImageData>,
)

data class ImageData(
    val url: String?,
    val b64_json: String?,
    val revised_prompt: String? = null,
)
```

> 注：`@Multipart` 不能 `@Body`，edit 接口所有字段拼成 `MultipartBody.Part` 列表。

### 5.2 Provider 适配

```kotlin
interface ProviderAdapter {
    fun buildApi(baseUrl: String, apiKey: String): ImageApi
    fun supportedSizes(): List<ImageSize>
    fun defaultSize(): ImageSize
}

class PackyAdapter : ProviderAdapter { /* 全 7 尺寸 */ }
class RunApiAdapter : ProviderAdapter { /* 1024/1536 系列 + 2048/2160 */ }
class CustomAdapter : ProviderAdapter { /* 默认全集 */ }
```

`ImageApi` 按 providerId 缓存到 `Map<Long, ImageApi>`，切换时重建。

### 5.3 OkHttp 配置

- `AuthInterceptor`：从当前 ProviderPreset 注入 `Authorization: Bearer <key>`
- `LoggingInterceptor`：仅 debug 构建
- 超时：`connect=15s, read=120s`
- 不做证书固定（中转站用现成 CA）

### 5.4 图片下载

生成成功后两步走：

1. API 返回 `url` → 插入消息（status=SUCCESS, imageLocalPath=null）
2. 后台协程下载到 `context.filesDir/generated/<messageId>.png`，更新 DB

下载失败：保留 remoteUrl，重试时再下。Coil 优先读 local，不存在则读 remote。

## 6. 错误处理

### 6.1 错误模型

```kotlin
sealed class ApiError(val httpCode: Int, val display: String) {
    class Unauthorized : ApiError(401, "密钥无效或已过期")
    class InsufficientBalance : ApiError(402, "余额不足")
    class RateLimited : ApiError(429, "请求过快，请稍后再试")
    class ContentFiltered(reason: String) : ApiError(200, "内容未通过审核：$reason")
    class BadRequest(msg: String) : ApiError(400, msg)
    class ServerError : ApiError(500, "服务异常，请稍后再试")
    class Network(t: Throwable) : ApiError(0, "网络异常：${t.message}")
}
```

`ContentFiltered`：HTTP 200 但 `data` 为空。

### 6.2 消息状态机

```
[PENDING] ─发送─▶ [GENERATING] ─200─▶ [SUCCESS]
                       │
                       ├─HTTP error─▶ [FAILED + ApiError]
                       └─Timeout/IO─▶ [FAILED + Network]
```

| 状态 | 用户气泡 | AI 气泡 |
|------|---------|---------|
| PENDING | 小菊花 | — |
| GENERATING | 灰色"已发送" | 骨架屏 + 圆环进度 + "正在创作…" |
| SUCCESS | 正常 | 图片卡片 + 操作栏 |
| FAILED | 不变 | 红边 + ⚠ + 文案 + 主操作按钮（重试 / 去设置，见 §6.5） |

GENERATING 文案每 5s 切换："勾勒中 / 渲染中 / 精修中"。

### 6.3 全局兜底

- **未配置 provider 进入 Chat** → 拦截器跳 Onboarding
- **切换 provider 时 Key 为空** → 弹"请先在设置中补全密钥"
- **首启无网络** → Onboarding 可继续，Home 顶部出现网络异常 Snackbar
- **生成中切后台** → 协程在 `viewModelScope`，应用进后台会被取消 → 切回前台若协程已死，标 FAILED 并提示"已中断，点击重试"

### 6.4 输入校验

- prompt 非空（trim 后）
- 编辑模式必须有附图
- prompt 长度 ≤ 4000 字符
- 附图：客户端压缩到最长边 2048px，>10MB 拒绝并提示

### 6.5 重试策略

- 失败消息**主操作按钮**统一显示，按错误类型切换文案：
  - 5xx / Network / 429：[重试] → 复用原 prompt + 参数，**不创建新消息**
  - 401：[去设置更新密钥] → 跳 Settings 对应 provider
  - 402 / 内容审核 / 4xx 其他：[我知道了]，不显示重试入口
- 网络错误可无限重试；4xx 不重试（避免无效请求浪费配额）

## 7. 测试

| 层 | 工具 | 重点 |
|----|------|------|
| Domain / UseCase | JUnit5 + MockK | 纯逻辑：参数校验、状态机分支 |
| Data / API | MockWebServer | Retrofit 契约、错误码映射 |
| Data / DB | Room in-memory + Turbine | Repository Flow、迁移 |
| UI / ViewModel | Compose UI Test + Turbine | Chat 状态流转、Onboarding 跳转 |
| 端到端 | Maestro | 1. 配 provider → 生成图 → 保存相册<br>2. 编辑上一张图 → 生成 → 失败重试 |

**黄金路径**：mock 本地 fake provider（返回固定 base64 图）走通完整流程，离线 e2e 演示。

不在 MVP 测试范围：覆盖率门槛、性能基准、国际化。

## 8. 关键风险与决策记录

- **多轮上下文 ≠ API 上下文**：中转站 API 不支持连续多轮 prompt，"上下文"仅是 UI 历史。已向用户确认。
- **密钥加密**：用 Tink + Android Keystore 加密后存 DataStore，避免明文落盘。
- **WorkManager 暂不引入**：MVP 用 viewModelScope 协程即可，避免后台任务调度复杂度。
- **流式不支持**：两个 API 都明确不支持 stream，不做尝试。
- **图片本地落盘**：所有生成图都存本地，理由——离线可用 / 防止远程 URL 过期 / 便于分享与再编辑。

## 9. 后续扩展（不在 MVP）

- WorkManager 后台重试 + 通知
- 多张参考图编辑（API 单张限制，未来若支持可加）
- 图片风格预设（胶片、动漫等）一键应用
- 会话导出 / 导入（JSON）
- 多语言
- 桌面小组件（快速出图）