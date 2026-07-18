# image2chat Android MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an Android 16 native app that lets users configure one or more image-generation relay providers (Packy / RunAPI / custom), chat in a multi-session UI to generate and edit images via `gpt-image-2`, and persist history locally.

**Architecture:** Single `:app` Gradle module. MVVM + Repository, organized by `data/domain/ui` packages. Coroutines + Flow for async, Room + DataStore for persistence, Tink for secret encryption, Retrofit + OkHttp + Moshi for networking, Coil for images, Compose + Material 3 for UI.

**Tech Stack:**
- Kotlin 2.0.21, AGP 8.7.3, Gradle 8.10.2
- Compose BOM 2024.10.01, Material 3 1.3.0
- minSdk 26, targetSdk 36, compileSdk 36, JVM 17
- Hilt 2.52, Navigation Compose 2.8.3
- Room 2.6.1, DataStore 1.1.1, Tink 1.13.0
- Retrofit 2.11.0, OkHttp 4.12.0, Moshi 1.15.1
- Coil 2.7.0, Coroutines 1.9.0
- Test: JUnit4 4.13.2, MockK 1.13.13, Turbine 1.1.0, Robolectric 4.13, MockWebServer 4.12.0, Compose UI Test, Maestro

## Global Constraints

- Kotlin source root: `app/src/main/kotlin/com/image2chat/app/`
- Test source root: `app/src/test/kotlin/com/image2chat/app/` (JVM) and `app/src/androidTest/kotlin/com/image2chat/app/` (instrumented)
- Package: `com.image2chat.app`
- All API calls go through `ProviderAdapter` — never call `ImageApi` directly from UI
- Secret strings (API keys) MUST be encrypted with Tink before persisting
- All API images are downloaded to `context.filesDir/generated/<messageId>.png` immediately after generation
- Default size `2048x1152`, quality `high`, model `gpt-image-2`, responseFormat `url` — never expose quality/model/responseFormat to UI
- No WorkManager, no streaming, no cloud sync — see spec §1.3
- Every PR-sized change commits; no `--amend` without explicit approval
- PowerShell (Windows) — chain commands with `; if ($?) { ... }`, never `&&`

---

## Phase 0 — Scaffolding

### Task 1: Gradle project + Application + MainActivity stub

**Files:**
- Create: `settings.gradle.kts`, `build.gradle.kts`, `gradle.properties`, `gradle/libs.versions.toml`, `app/build.gradle.kts`, `app/proguard-rules.pro`, `app/src/main/AndroidManifest.xml`, `app/src/main/kotlin/com/image2chat/app/Image2ChatApp.kt`, `app/src/main/kotlin/com/image2chat/app/MainActivity.kt`, theme files, `app/src/main/res/values/strings.xml`, `app/src/main/res/values/themes.xml`, `app/src/main/res/values/colors.xml`, `app/src/main/res/xml/data_extraction_rules.xml`, `app/src/main/res/xml/backup_rules.xml`, `gradle/wrapper/gradle-wrapper.properties`, `.gitignore`

- [ ] **Step 1: Write `.gitignore`** — `gradle/ build/ .idea/ *.iml local.properties .kotlin/`

- [ ] **Step 2: Write `gradle.properties`**
```properties
org.gradle.jvmargs=-Xmx4096m -Dfile.encoding=UTF-8
org.gradle.parallel=true
org.gradle.caching=true
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official
```

- [ ] **Step 3: Write `settings.gradle.kts`**
```kotlin
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "image2chat"
include(":app")
```

- [ ] **Step 4: Write `gradle/libs.versions.toml`**

Use the contents from the brainstorming design — full toml with all versions listed earlier. See "Tech Stack" section.

- [ ] **Step 5: Write root `build.gradle.kts`**
```kotlin
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.hilt) apply false
}
```

- [ ] **Step 6: Write `app/build.gradle.kts`** — Android namespace `com.image2chat.app`, minSdk 26, targetSdk 36, compileSdk 36, JVM 17, sourceSets mapping `kotlin/`, all dependencies from version catalog (see Tech Stack). Use the full dependencies block from the earlier draft.

- [ ] **Step 7: Write `app/proguard-rules.pro`** — `-keep class com.image2chat.app.data.api.** { *; }`

- [ ] **Step 8: Write `AndroidManifest.xml`** — INTERNET + READ_MEDIA_IMAGES perms, Application = `.Image2ChatApp`, Activity = `.MainActivity` with LAUNCHER intent filter, theme = `@style/Theme.Image2Chat`.

- [ ] **Step 9: Write `strings.xml` / `themes.xml` / `colors.xml`**
  - `app_name=image2chat`
  - theme inherits `android:Theme.Material.Light.NoActionBar`
  - seed color `#FF6750A4`

- [ ] **Step 10: Write `data_extraction_rules.xml` + `backup_rules.xml`** — exclude `secret_store.xml`.

- [ ] **Step 11: Write theme files** — `Color.kt` (Purple80/40), `Type.kt`, `Theme.kt` (dark/light schemes). See earlier draft for exact code.

- [ ] **Step 12: Write `Image2ChatApp.kt`**
```kotlin
package com.image2chat.app
import android.app.Application
import dagger.hilt.android.HiltAndroidApp
@HiltAndroidApp
class Image2ChatApp : Application()
```

- [ ] **Step 13: Write `MainActivity.kt`**
```kotlin
package com.image2chat.app
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.image2chat.app.ui.theme.Image2ChatTheme
import dagger.hilt.android.AndroidEntryPoint
@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            Image2ChatTheme {
                Scaffold(Modifier.fillMaxSize()) { inner ->
                    Text("image2chat", Modifier.padding(inner))
                }
            }
        }
    }
}
```

- [ ] **Step 14: Generate Gradle wrapper** — Run: `gradle wrapper --gradle-version 8.10.2` (uses locally installed Gradle). Verify `gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar` exist.

- [ ] **Step 15: Write `gradle-wrapper.properties`** — `distributionUrl=https\://services.gradle.org/distributions/gradle-8.10.2-bin.zip`

- [ ] **Step 16: Verify build** — Run `./gradlew assembleDebug`. Expected: BUILD SUCCESSFUL.

- [ ] **Step 17: Commit** — `git add .; git commit -m "chore: scaffold android project (gradle, hilt, compose, theme)"`

> **Reference for full file contents of this task:** see the "Task 1: Gradle project" block in the brainstorm output (earlier in this conversation). Use exact code from there for any file not explicitly shown above.

---

## Phase 1 — Domain & Data

### Task 2: Domain models + ImageSize + ApiError

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/domain/model/ImageSize.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/domain/model/ProviderType.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/data/api/ApiError.kt`
- Test: `app/src/test/kotlin/com/image2chat/app/domain/model/ModelsTest.kt`

- [ ] **Step 1: Write failing test `ModelsTest.kt`**
```kotlin
package com.image2chat.app.domain.model
import com.image2chat.app.data.api.ApiError
import org.junit.Assert.assertEquals
import org.junit.Test
class ModelsTest {
    @Test fun `ImageSize parses WxH`() { assertEquals(2048 to 1152, ImageSize.SIZE_2048x1152.dimensions) }
    @Test fun `ImageSize fromToken returns matching constant`() { assertEquals(ImageSize.SIZE_1024x1024, ImageSize.fromToken("1024x1024")) }
    @Test fun `ImageSize fromToken falls back to default`() { assertEquals(ImageSize.SIZE_2048x1152, ImageSize.fromToken("garbage")) }
    @Test fun `ApiError toDisplay message`() { assertEquals("密钥无效或已过期", ApiError.Unauthorized.display) }
}
```

- [ ] **Step 2: Verify test fails** — `./gradlew testDebugUnitTest` should fail with compile errors.

- [ ] **Step 3: Write `ImageSize.kt`**
```kotlin
package com.image2chat.app.domain.model
enum class ImageSize(val token: String, val label: String) {
    SIZE_1024x1024("1024x1024", "1:1"),
    SIZE_1536x1024("1536x1024", "横向"),
    SIZE_1024x1536("1024x1536", "纵向"),
    SIZE_2048x2048("2048x2048", "2K 正方形"),
    SIZE_2048x1152("2048x1152", "2K 横向"),
    SIZE_3840x2160("3840x2160", "4K 横向"),
    SIZE_2160x3840("2160x3840", "4K 纵向");
    val dimensions: Pair<Int, Int>
        get() = token.split("x").let { (w, h) -> w.toInt() to h.toInt() }
    companion object {
        val DEFAULT: ImageSize = SIZE_2048x1152
        fun fromToken(token: String): ImageSize = entries.firstOrNull { it.token == token } ?: DEFAULT
    }
}
```

- [ ] **Step 4: Write `ProviderType.kt`**
```kotlin
package com.image2chat.app.domain.model
enum class ProviderType(val displayName: String) {
    PACKY("Packy"), RUNAPI("RunAPI"), CUSTOM("自定义");
    fun defaultSize(): ImageSize = ImageSize.DEFAULT
}
```

- [ ] **Step 5: Write `ApiError.kt`**
```kotlin
package com.image2chat.app.data.api
sealed class ApiError(val httpCode: Int, open val display: String) {
    data object Unauthorized : ApiError(401, "密钥无效或已过期")
    data object InsufficientBalance : ApiError(402, "余额不足")
    data class RateLimited(val retryAfterSec: Int? = null) : ApiError(429, "请求过快，请稍后再试")
    data class ContentFiltered(val reason: String) : ApiError(200, "内容未通过审核：$reason")
    data class BadRequest(override val display: String) : ApiError(400, display)
    data class ServerError(val detail: String) : ApiError(500, "服务异常，请稍后再试")
    data class Network(val cause: Throwable) : ApiError(0, "网络异常：${cause.message ?: "未知"}")
}
```

- [ ] **Step 6: Verify test passes** — `./gradlew testDebugUnitTest` should pass.

- [ ] **Step 7: Commit** — `git commit -m "feat(domain): ImageSize, ProviderType, ApiError sealed types"`

---

### Task 3: Room — ProviderPreset entity, DAO, repository

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/data/db/ProviderPresetEntity.kt`, `ProviderPresetDao.kt`, `AppDatabase.kt`, `Converters.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/data/prefs/SecretStore.kt` (interface stub)
- Create: `app/src/main/kotlin/com/image2chat/app/data/repo/ProviderRepository.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/di/DbModule.kt`
- Test: `app/src/test/kotlin/com/image2chat/app/data/repo/ProviderRepositoryTest.kt`

- [ ] **Step 1: Write failing test `ProviderRepositoryTest.kt`** — Robolectric test using Room in-memory DB; mock `SecretStore` with relaxed=true and stub `encrypt`/`decrypt`; verify `upsert` persists `apiKeyEncrypted` (cipher) and `repo.get()` decrypts it back.

- [ ] **Step 2: Verify test fails** — `./gradlew testDebugUnitTest` should fail with compile errors.

- [ ] **Step 3: Write `ProviderPresetEntity.kt`** — Room entity with `id`, `name`, `baseUrl`, `apiKeyEncrypted`, `type` (ProviderType), `isBuiltIn`, `createdAt`.

- [ ] **Step 4: Write `Converters.kt`** — TypeConverters for `ProviderType` only at this stage.

- [ ] **Step 5: Write `ProviderPresetDao.kt`** — `@Dao` with `observeAll(): Flow<List<...>>`, `getById`, `insert`, `update`, `delete`, `count`.

- [ ] **Step 6: Write `AppDatabase.kt`** — `@Database(entities=[ProviderPresetEntity::class], version=1)`.

- [ ] **Step 7: Write `SecretStore.kt` interface**
```kotlin
package com.image2chat.app.data.prefs
interface SecretStore {
    suspend fun encrypt(plain: String): String
    suspend fun decrypt(cipher: String): String
}
```

- [ ] **Step 8: Write `ProviderRepository.kt`**
```kotlin
package com.image2chat.app.data.repo
import com.image2chat.app.data.db.ProviderPresetDao
import com.image2chat.app.data.db.ProviderPresetEntity
import com.image2chat.app.data.prefs.SecretStore
import com.image2chat.app.domain.model.ProviderType
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
data class ProviderPreset(val id: Long, val name: String, val baseUrl: String, val apiKey: String, val type: ProviderType, val isBuiltIn: Boolean, val createdAt: Long)
class ProviderRepository(private val dao: ProviderPresetDao, private val secretStore: SecretStore) {
    fun observe(): Flow<List<ProviderPreset>> = dao.observeAll().map { it.map { e -> e.toModel() } }
    suspend fun get(id: Long): ProviderPreset? = dao.getById(id)?.toModel()
    suspend fun upsert(p: ProviderPreset): Long {
        val enc = secretStore.encrypt(p.apiKey)
        val e = ProviderPresetEntity(p.id, p.name, p.baseUrl, enc, p.type, p.isBuiltIn, p.createdAt)
        return if (p.id == 0L) dao.insert(e) else { dao.update(e); p.id }
    }
    suspend fun delete(id: Long) { dao.getById(id)?.let { dao.delete(it) } }
    private suspend fun ProviderPresetEntity.toModel() = ProviderPreset(id, name, baseUrl, secretStore.decrypt(apiKeyEncrypted), type, isBuiltIn, createdAt)
}
```

- [ ] **Step 9: Write `DbModule.kt`** — Hilt module providing `AppDatabase` (singleton) and `ProviderPresetDao`.

- [ ] **Step 10: Verify tests pass** — `./gradlew testDebugUnitTest` should pass.

- [ ] **Step 11: Commit** — `git commit -m "feat(data): ProviderPreset Room entity, DAO, repository"`

---

### Task 4: Conversation + Message entities/DAOs + ConversationRepository

**Files:**
- Modify: `AppDatabase.kt` (bump version 1→2, add new entities + abstract DAOs)
- Modify: `Converters.kt` (add Size/Role/Kind/Status converters)
- Modify: `DbModule.kt` (provide new DAOs)
- Create: `ConversationEntity.kt`, `MessageEntity.kt`, `ConversationDao.kt`, `MessageDao.kt`
- Create: `ConversationRepository.kt`
- Test: `ConversationRepositoryTest.kt`

- [ ] **Step 1: Write failing test `ConversationRepositoryTest.kt`** — Robolectric; assert `createConversation` returns id, `appendMessage(USER, TEXT_PROMPT, "first prompt")` updates conversation title to first 20 chars of prompt, `observeMessages` returns in `createdAt` order, `updateMessageStatus` persists FAILED + errorCode.

- [ ] **Step 2: Verify test fails.**

- [ ] **Step 3: Write `ConversationEntity.kt`** — id/title/createdAt/updatedAt/providerPresetId.

- [ ] **Step 4: Write `MessageEntity.kt`** — id, conversationId (FK CASCADE), role, kind, prompt, imageLocalPath, remoteImageUrl, size, status, errorCode, createdAt. Enums `MessageRole`, `MessageKind`, `MessageStatus` declared in same file.

- [ ] **Step 5: Write `ConversationDao.kt`** — `observeAll`, `getById`, `insert`, `update`, `delete`.

- [ ] **Step 6: Write `MessageDao.kt`** — `observeByConversation(convId)`, `getById`, `insert`, `update`.

- [ ] **Step 7: Update `AppDatabase.kt`** — version=2, add entities + abstract DAOs.

- [ ] **Step 8: Update `Converters.kt`** — add Size/Role/Kind/Status converters.

- [ ] **Step 9: Update `DbModule.kt`** — provide new DAOs.

- [ ] **Step 10: Write `ConversationRepository.kt`**
  - Data classes `Conversation(id, title, createdAt, updatedAt, providerPresetId)` and `Message(id, conversationId, role, kind, prompt, imageLocalPath, remoteImageUrl, size, status, errorCode, createdAt)`.
  - Methods: `observeConversations()`, `observeMessages(convId)`, `getConversation(id)`, `createConversation(providerPresetId)`, `renameConversation(id, title)`, `deleteConversation(id)`, `appendMessage(...)`, `updateMessageStatus(id, status, errorCode?)`, `setMessageImagePath(id, path)`, `setMessageRemoteUrl(id, url)`, `getMessage(id)`.
  - `createConversation` writes title="新对话", `appendMessage` for TEXT_PROMPT updates conv title to `prompt.take(20)` if title still "新对话", else touches `updatedAt`.

- [ ] **Step 11: Verify tests pass.**

- [ ] **Step 12: Commit** — `git commit -m "feat(data): Conversation, Message entities, DAOs, ConversationRepository"`

---

### Task 5: SecretStore with Tink encryption

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/data/prefs/TinkSecretStore.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/di/SecurityModule.kt`
- Test: `app/src/test/kotlin/com/image2chat/app/data/prefs/TinkSecretStoreTest.kt`

- [ ] **Step 1: Write failing test `TinkSecretStoreTest.kt`** — Robolectric; assert `encrypt → decrypt` roundtrip yields original; assert two `encrypt("sk-same")` calls produce different ciphertexts (nonce randomness).

- [ ] **Step 2: Verify test fails.**

- [ ] **Step 3: Write `TinkSecretStore.kt`**
```kotlin
package com.image2chat.app.data.prefs
import android.content.Context
import com.google.crypto.tink.Aead
import com.google.crypto.tink.KeyTemplates
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.integration.android.AndroidKeysetManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Base64
class TinkSecretStore(private val context: Context) : SecretStore {
    private val aead: Aead by lazy {
        AeadConfig.register()
        AndroidKeysetManager.Builder()
            .withSharedPref(context, "image2chat_keyset", "image2chat_keyset_prefs")
            .withKeyTemplate(KeyTemplates.get("AES256_GCM"))
            .withMasterKeyUri("android-keystore://image2chat_master_key")
            .build().keysetHandle.getPrimitive(Aead::class.java)
    }
    override suspend fun encrypt(plain: String): String = withContext(Dispatchers.IO) {
        Base64.getEncoder().encodeToString(aead.encrypt(plain.toByteArray(Charsets.UTF_8), AD))
    }
    override suspend fun decrypt(cipher: String): String = withContext(Dispatchers.IO) {
        String(aead.decrypt(Base64.getDecoder().decode(cipher), AD), Charsets.UTF_8)
    }
    private companion object { val AD: ByteArray = "image2chat".toByteArray(Charsets.UTF_8) }
}
```

- [ ] **Step 4: Write `SecurityModule.kt`** — Hilt singleton providing `TinkSecretStore` as `SecretStore`.

- [ ] **Step 5: Verify test passes.**

- [ ] **Step 6: Commit** — `git commit -m "feat(security): TinkSecretStore with Android Keystore master key"`

---

### Task 6: AppPreferences DataStore

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/data/prefs/AppPreferences.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/di/PreferencesModule.kt`
- Test: `app/src/test/kotlin/com/image2chat/app/data/prefs/AppPreferencesTest.kt`

- [ ] **Step 1: Write failing test `AppPreferencesTest.kt`** — Robolectric; assert `defaultSize` emits `ImageSize.SIZE_2048x1152` initially; `setSelectedProviderId(42)` causes `selectedProviderId` Flow to emit `42L`.

- [ ] **Step 2: Verify test fails.**

- [ ] **Step 3: Write `AppPreferences.kt`**
```kotlin
package com.image2chat.app.data.prefs
import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.image2chat.app.domain.model.ImageSize
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
private val Context.dataStore by preferencesDataStore(name = "app_prefs")
class AppPreferences(private val context: Context) {
    private val keyPid = longPreferencesKey("selected_provider_id")
    private val keySize = stringPreferencesKey("default_size")
    val selectedProviderId: Flow<Long?> = context.dataStore.data.map { it[keyPid] }
    val defaultSize: Flow<ImageSize> = context.dataStore.data.map {
        it[keySize]?.let { t -> ImageSize.entries.firstOrNull { e -> e.token == t } } ?: ImageSize.DEFAULT
    }
    suspend fun setSelectedProviderId(id: Long) { context.dataStore.edit { it[keyPid] = id } }
    suspend fun setDefaultSize(size: ImageSize) { context.dataStore.edit { it[keySize] = size.token } }
}
```

- [ ] **Step 4: Write `PreferencesModule.kt`** — Hilt singleton providing `AppPreferences`.

- [ ] **Step 5: Verify test passes.**

- [ ] **Step 6: Commit** — `git commit -m "feat(prefs): AppPreferences DataStore"`

---

## Phase 2 — Network

### Task 7: API DTOs + ImageApi Retrofit interface + MockWebServer contract test

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/data/api/Dtos.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/data/api/ImageApi.kt`
- Test: `app/src/test/kotlin/com/image2chat/app/data/api/ImageApiTest.kt`

- [ ] **Step 1: Write failing test `ImageApiTest.kt`** — MockWebServer; enqueue `{"created":1,"data":[{"url":"https://x/1.png","revised_prompt":"r"}]}`; build Retrofit + Moshi; call `api.generate(GenerateRequest("cat","2048x1152"))`; assert recorded path == `/v1/images/generations`; assert response data[0].url.

- [ ] **Step 2: Verify test fails.**

- [ ] **Step 3: Write `Dtos.kt`** — `@JsonClass(generateAdapter=true)` for `GenerateRequest(prompt, n=1, size, quality="high", response_format="url", user?, model="gpt-image-2")`, `GenerateResponse(created, data: List<ImageData>)`, `ImageData(url?, b64_json?, revised_prompt?)`.

- [ ] **Step 4: Write `ImageApi.kt`** — initially with `@Header("Authorization") bearer: String` parameter (will be removed in Task 9).
```kotlin
interface ImageApi {
    @POST("v1/images/generations") suspend fun generate(@Body req: GenerateRequest, @Header("Authorization") bearer: String): GenerateResponse
    @Multipart @POST("v1/images/edits") suspend fun edit(@Part parts: List<MultipartBody.Part>, @Header("Authorization") bearer: String): GenerateResponse
}
```

- [ ] **Step 5: Verify test passes.**

- [ ] **Step 6: Commit** — `git commit -m "feat(api): ImageApi Retrofit interface + DTOs"`

---

### Task 8: ApiResult sealed type + error parser + tests

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/data/api/ApiResult.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/data/api/ApiErrorParser.kt`
- Test: `app/src/test/kotlin/com/image2chat/app/data/api/ApiErrorParserTest.kt`

- [ ] **Step 1: Write failing test `ApiErrorParserTest.kt`** — cover: 401→Unauthorized, 402→InsufficientBalance, 429→RateLimited, 500→ServerError, 400 with body `{"error":{"message":"bad size"}}`→BadRequest("bad size"), 200 with empty `data`→ContentFiltered, IOException→Network.

- [ ] **Step 2: Verify test fails.**

- [ ] **Step 3: Write `ApiResult.kt`**
```kotlin
sealed class ApiResult<out T> {
    data class Success<T>(val value: T) : ApiResult<T>()
    data class Failure(val error: ApiError) : ApiResult<Nothing>()
    inline fun <R> map(transform: (T) -> R): ApiResult<R> = when (this) { is Success -> Success(transform(value)); is Failure -> this }
    fun getOrNull(): T? = (this as? Success)?.value
}
```

- [ ] **Step 4: Write `ApiErrorParser.kt`**
```kotlin
@JsonClass(generateAdapter=true) data class OpenAiErrorEnvelope(val error: OpenAiErrorBody? = null)
@JsonClass(generateAdapter=true) data class OpenAiErrorBody(val message: String? = null, val type: String? = null, val code: String? = null)
object ApiErrorParser {
    private val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
    private val adapter = moshi.adapter(OpenAiErrorEnvelope::class.java)
    fun fromHttp(code: Int, body: String?): ApiError {
        val msg = body?.let { runCatching { adapter.fromJson(it)?.error?.message }.getOrNull() }
        return when (code) {
            200 -> ApiError.ContentFiltered(reason = msg ?: "返回为空")
            401 -> ApiError.Unauthorized
            402 -> ApiError.InsufficientBalance
            429 -> ApiError.RateLimited()
            400 -> ApiError.BadRequest(display = msg ?: "请求参数错误")
            in 500..599 -> ApiError.ServerError(detail = msg ?: "")
            else -> ApiError.BadRequest(display = msg ?: "未知错误 ($code)")
        }
    }
    fun fromThrowable(t: Throwable): ApiError = ApiError.Network(t)
}
```

- [ ] **Step 5: Verify tests pass.**

- [ ] **Step 6: Commit** — `git commit -m "feat(api): ApiResult + ApiErrorParser"`

---

### Task 9: AuthInterceptor + ApiClient + NetworkModule

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/data/api/AuthInterceptor.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/data/api/ApiClient.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/di/NetworkModule.kt`
- Modify: `ImageApi.kt` (drop `@Header` parameter; rely on interceptor)
- Modify: `ImageApiTest.kt` (drop bearer arg)
- Test: `app/src/test/kotlin/com/image2chat/app/data/api/AuthInterceptorTest.kt`

- [ ] **Step 1: Write failing test `AuthInterceptorTest.kt`** — two tests: with non-null token provider, assert recorded header == `Bearer sk-xyz`; with null provider, assert header is null.

- [ ] **Step 2: Verify test fails.**

- [ ] **Step 3: Write `AuthInterceptor.kt`**
```kotlin
class AuthInterceptor(private val tokenProvider: () -> String?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenProvider()
        val req = if (token != null) chain.request().newBuilder().addHeader("Authorization", "Bearer $token").build() else chain.request()
        return chain.proceed(req)
    }
}
```

- [ ] **Step 4: Update `ImageApi.kt`** — remove `@Header("Authorization") bearer: String` from both methods.

- [ ] **Step 5: Write `ApiClient.kt`**
```kotlin
class ApiClient(private val moshi: Moshi, private val baseOkHttp: OkHttpClient) {
    private val cache = ConcurrentHashMap<String, ImageApi>()
    fun api(baseUrl: String, tokenProvider: () -> String?): ImageApi =
        cache.getOrPut("$baseUrl|${tokenProvider()}") {
            val client = baseOkHttp.newBuilder().addInterceptor(AuthInterceptor(tokenProvider)).build()
            Retrofit.Builder()
                .baseUrl(baseUrl.trimEnd('/') + "/")
                .client(client)
                .addConverterFactory(MoshiConverterFactory.create(moshi))
                .build()
                .create(ImageApi::class.java)
        }
}
```

- [ ] **Step 6: Write `NetworkModule.kt`** — provides `Moshi` (with `KotlinJsonAdapterFactory`), `OkHttpClient` (15s/120s timeout + logging interceptor BASIC), and `ApiClient` (singleton).

- [ ] **Step 7: Update `ImageApiTest.kt`** — drop bearer arg from `api.generate(req)`; recorded header assertion still null.

- [ ] **Step 8: Verify all API tests pass.**

- [ ] **Step 9: Commit** — `git commit -m "feat(api): AuthInterceptor, ApiClient, NetworkModule"`

---

### Task 10: ProviderAdapter (Packy, RunApi, Custom) + size whitelist

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/data/api/ProviderAdapter.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/data/api/PackyAdapter.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/data/api/RunApiAdapter.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/data/api/CustomAdapter.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/data/api/ProviderRegistry.kt`
- Test: `app/src/test/kotlin/com/image2chat/app/data/api/ProviderRegistryTest.kt`

- [ ] **Step 1: Write failing test `ProviderRegistryTest.kt`** — assert `PACKY` exposes 7 sizes; `RUNAPI` excludes `3840x2160` and `2160x3840`; base URLs; `CustomAdapter("https://my.example.com")` exposes all 7 sizes.

- [ ] **Step 2: Verify test fails.**

- [ ] **Step 3: Write `ProviderAdapter.kt`** — interface with `val type`, `fun supportedSizes(): List<ImageSize>`, `fun baseUrl(): String`.

- [ ] **Step 4: Write `PackyAdapter.kt`**, **Step 5: Write `RunApiAdapter.kt`**, **Step 6: Write `CustomAdapter.kt`** — implement per spec §3.5 / §5.2 (Packy all 7, RunAPI excludes 4K, Custom configurable URL all 7).

- [ ] **Step 7: Write `ProviderRegistry.kt`** — `object` with `fun adapterFor(type, customUrl?): ProviderAdapter`.

- [ ] **Step 8: Verify tests pass.**

- [ ] **Step 9: Commit** — `git commit -m "feat(api): ProviderAdapter for PACKY/RUNAPI/CUSTOM"`

---

### Task 11: GenerationRepository — orchestrate API + DB + image download

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/data/repo/ImageDownloader.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/data/repo/GenerationRepository.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/di/RepoModule.kt`
- Test: `app/src/test/kotlin/com/image2chat/app/data/repo/GenerationRepositoryTest.kt`

- [ ] **Step 1: Write failing test `GenerationRepositoryTest.kt`** — Robolectric + MockWebServer; `providerRepo.get` returns fake preset; `convRepo.appendMessage` returns `100L` (user) and `101L` (assistant); enqueue 200 response with `{"data":[{"url":"http://localhost/x.png"}]}`; assert `repo.generate(7, "cat", SIZE_2048x1152)` returns `Result.success(101L)`; mock `ImageDownloader.downloadTo` and verify called with the URL.

- [ ] **Step 2: Verify test fails.**

- [ ] **Step 3: Write `ImageDownloader.kt`**
```kotlin
class ImageDownloader(private val client: OkHttpClient = OkHttpClient()) {
    suspend fun downloadTo(url: String, dest: File): Result<File> = runCatching {
        val req = Request.Builder().url(url).build()
        client.newCall(req).execute().use { resp ->
            check(resp.isSuccessful) { "HTTP ${resp.code}" }
            dest.parentFile?.mkdirs()
            resp.body!!.byteStream().use { input -> dest.outputStream().use { input.copyTo(it) } }
        }
        dest
    }
}
```

- [ ] **Step 4: Write `GenerationRepository.kt`** — constructor takes `apiFactory: (baseUrl: String, tokenProvider: () -> String?) -> ImageApi` (NOT a single `ImageApi`) plus `convRepo`, `providerRepo`, `downloader`, `providerRegistry`, `filesDir`, `userAgent`, `downloadScope`.

`suspend fun generate(conversationId, prompt, size, editSourceMessageId?): Result<Long>`:
1. fetch conversation via `convRepo.getConversation(id)` → fail if null
2. fetch provider via `providerRepo.get(conv.providerPresetId)` → fail if null
3. append assistant `IMAGE_RESULT` message with status `GENERATING` → capture `assistantId`
4. resolve `api = apiFactory(provider.baseUrl) { provider.apiKey }`
5. if `editSourceMessageId != null`: copy source to temp file (download if remote), build `MultipartBody.Part` list (model, prompt, image, n, size, quality, response_format), call `api.edit(parts)`
6. else: call `api.generate(GenerateRequest(prompt, size.token, user=userAgent))`
7. take `response.data.firstOrNull()?.url ?: throw ContentFiltered("返回为空")`
8. `convRepo.setMessageRemoteUrl(assistantId, url)`; `convRepo.updateMessageStatus(assistantId, SUCCESS)`
9. launch on `downloadScope` to download URL → `filesDir/generated/<assistantId>.png` → `setMessageImagePath`
10. on throw: `ApiErrorParser.fromThrowable(t)` if not already `ApiError`; `convRepo.updateMessageStatus(assistantId, FAILED, httpCode.toString())`; rethrow

- [ ] **Step 5: Write `RepoModule.kt`** — provides `ImageDownloader` (singleton), `CoroutineScope` (`SupervisorJob() + Dispatchers.IO`), and `GenerationRepository` wiring `apiFactory = { baseUrl, tokenProvider -> client.api(baseUrl, tokenProvider) }`.

- [ ] **Step 6: Verify test passes.**

- [ ] **Step 7: Commit** — `git commit -m "feat(repo): GenerationRepository orchestrates API + DB + image download"`

---

## Phase 3 — UI

### Task 12: Theme polish verification (no-op)

- [ ] **Step 1: Verify build** — `./gradlew assembleDebug` succeeds (theme already created in Task 1).

---

### Task 13: Navigation graph + start-destination logic

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/ui/nav/Routes.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/ui/AppEntry.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/ui/onboarding/OnboardingRoute.kt` (stub)
- Create: `app/src/main/kotlin/com/image2chat/app/ui/home/HomeRoute.kt` (stub)
- Create: `app/src/main/kotlin/com/image2chat/app/ui/chat/ChatRoute.kt` (stub)
- Modify: `app/src/main/kotlin/com/image2chat/app/MainActivity.kt`

- [ ] **Step 1: Write `Routes.kt`**
```kotlin
object Routes {
    const val ONBOARDING = "onboarding"
    const val HOME = "home"
    const val CHAT = "chat/{convId}"
    fun chat(convId: Long) = "chat/$convId"
}
```

- [ ] **Step 2: Write `AppEntry.kt`** — `@HiltViewModel AppEntryViewModel` exposes `hasProvider: Flow<Boolean>` from `providerRepo.observe().map { it.isNotEmpty() }`. `@Composable AppEntry` collects it, sets `NavHost startDestination` accordingly, with three `composable(...)` entries. Initial value `true` to avoid onboarding flash on warm start (data is loaded synchronously enough that the real value arrives before first frame; the brief flicker is acceptable for MVP).

- [ ] **Step 3: Replace `MainActivity.kt`** — `setContent { Image2ChatTheme { AppEntry() } }`.

- [ ] **Step 4: Add stub routes** — Each stub renders `Text("TODO")`.

- [ ] **Step 5: Verify build** — `./gradlew assembleDebug`.

- [ ] **Step 6: Commit** — `git commit -m "feat(ui): navigation graph + AppEntry start-destination logic"`

---

### Task 14: Onboarding screen + ViewModel + tests

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/ui/onboarding/OnboardingViewModel.kt`
- Modify: `app/src/main/kotlin/com/image2chat/app/ui/onboarding/OnboardingRoute.kt`
- Test: `app/src/test/kotlin/com/image2chat/app/ui/onboarding/OnboardingViewModelTest.kt`

- [ ] **Step 1: Write failing test `OnboardingViewModelTest.kt`** — assert `builtInTemplates` exposes `PACKY` + `RUNAPI`; `finish` saves via `repo.upsert` with the right type/key; `finish` with blank key does NOT save (verifying `errorKeyEmpty` flag).

- [ ] **Step 2: Verify test fails.**

- [ ] **Step 3: Write `OnboardingViewModel.kt`**
```kotlin
data class ProviderTemplate(val type: ProviderType, val defaultName: String, val defaultUrl: String)
data class OnboardingUiState(val selectedType: ProviderType? = null, val draftName: String = "", val draftUrl: String = "", val draftKey: String = "", val errorKeyEmpty: Boolean = false)
@HiltViewModel
class OnboardingViewModel @Inject constructor(private val repo: ProviderRepository) : ViewModel() {
    val builtInTemplates = listOf(
        ProviderTemplate(ProviderType.PACKY, "Packy", "https://www.packyapi.com"),
        ProviderTemplate(ProviderType.RUNAPI, "RunAPI", "https://runapi.co"),
    )
    private val _state = MutableStateFlow(OnboardingUiState())
    val state: StateFlow<OnboardingUiState> = _state.asStateFlow()
    fun selectTemplate(type: ProviderType) { val tpl = builtInTemplates.firstOrNull { it.type == type }
        _state.value = OnboardingUiState(selectedType = type, draftName = tpl?.defaultName ?: "", draftUrl = tpl?.defaultUrl ?: "", draftKey = "") }
    fun setCustomName(v: String) { _state.value = _state.value.copy(draftName = v) }
    fun setCustomUrl(v: String) { _state.value = _state.value.copy(draftUrl = v) }
    fun setKey(v: String) { _state.value = _state.value.copy(draftKey = v) }
    fun finish() {
        val s = _state.value; val type = s.selectedType ?: return
        if (s.draftKey.isBlank()) { _state.value = s.copy(errorKeyEmpty = true); return }
        viewModelScope.launch { repo.upsert(ProviderPreset(0, s.draftName.ifBlank { type.displayName }, s.draftUrl, s.draftKey.trim(), type, type != ProviderType.CUSTOM, System.currentTimeMillis())) }
    }
}
```

- [ ] **Step 4: Write `OnboardingRoute.kt` UI** — Two steps. Step 0: list cards (PACKY, RUNAPI) + "自定义" text button → on click `selectTemplate` + advance to step 1. Step 1: for non-CUSTOM show read-only "中转站/域名"; for CUSTOM show name + url OutlinedTextFields; always show key field with `KeyboardOptions(keyboardType = KeyboardType.Password)`; "完成" button calls `vm.finish()`. LaunchedEffect: when `state.draftKey.isNotBlank() && selectedType != null`, navigate via `onDone()`. (Note: the LaunchedEffect will fire as soon as key is non-empty after entering step 1 — this is a known design simplification; replace with explicit save-and-navigate in a follow-up.)

- [ ] **Step 5: Verify tests + build** — `./gradlew testDebugUnitTest assembleDebug`.

- [ ] **Step 6: Commit** — `git commit -m "feat(ui): Onboarding screen + ViewModel"`

---

### Task 15: Home screen — drawer + conversation list

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/ui/home/HomeViewModel.kt`
- Modify: `app/src/main/kotlin/com/image2chat/app/ui/home/HomeRoute.kt`
- Test: `app/src/test/kotlin/com/image2chat/app/ui/home/HomeViewModelTest.kt`

- [ ] **Step 1: Write failing test `HomeViewModelTest.kt`** — assert `createConversation()` calls `convRepo.createConversation(activeProvider.id)`; `switchProvider(2)` calls `prefs.setSelectedProviderId(2)`.

- [ ] **Step 2: Verify test fails.**

- [ ] **Step 3: Write `HomeViewModel.kt`**
```kotlin
@HiltViewModel
class HomeViewModel @Inject constructor(private val convRepo: ConversationRepository, private val providerRepo: ProviderRepository, private val prefs: AppPreferences) : ViewModel() {
    val conversations: StateFlow<List<Conversation>> = convRepo.observeConversations().stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    private val activeProviderId = MutableStateFlow<Long?>(null)
    init { viewModelScope.launch { prefs.selectedProviderId.collect { activeProviderId.value = it } } }
    val activeProvider: StateFlow<ProviderPreset?> = combine(providerRepo.observe(), activeProviderId) { ps, id -> id?.let { i -> ps.firstOrNull { it.id == i } } ?: ps.firstOrNull() }.stateIn(viewModelScope, SharingStarted.Eagerly, null)
    fun createConversation(): Long? { val pid = activeProvider.value?.id ?: return null; var id: Long? = null; viewModelScope.launch { id = convRepo.createConversation(pid) }; return id }
    fun renameConversation(id: Long, t: String) { viewModelScope.launch { convRepo.renameConversation(id, t) } }
    fun deleteConversation(id: Long) { viewModelScope.launch { convRepo.deleteConversation(id) } }
    fun switchProvider(id: Long) { viewModelScope.launch { prefs.setSelectedProviderId(id) } }
}
```

- [ ] **Step 4: Write `HomeRoute.kt` UI** — `ModalNavigationDrawer`; drawer header shows current provider name + FAB "+" to create new conversation; `LazyColumn` of `ConversationRow` cards; main content empty-state "开始一次新的创作".

- [ ] **Step 5: Verify tests + build.**

- [ ] **Step 6: Commit** — `git commit -m "feat(ui): Home screen with drawer + conversation list"`

---

### Task 16: Chat — message list, bubbles, status placeholder

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/ui/chat/ChatViewModel.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/ui/chat/MessageBubble.kt`
- Modify: `app/src/main/kotlin/com/image2chat/app/ui/chat/ChatRoute.kt`
- Test: `app/src/test/kotlin/com/image2chat/app/ui/chat/ChatViewModelTest.kt`

- [ ] **Step 1: Write failing test `ChatViewModelTest.kt`** — assert `send("cat")` calls `convRepo.appendMessage(USER, TEXT_PROMPT, "cat", SIZE_2048x1152, PENDING)` then `genRepo.generate(7, "cat", SIZE_2048x1152, null)`; `retry(messageId)` re-fetches message and calls `genRepo.generate` with the original prompt.

- [ ] **Step 2: Verify test fails.**

- [ ] **Step 3: Write `ChatViewModel.kt`**
```kotlin
@HiltViewModel
class ChatViewModel @Inject constructor(
    savedState: SavedStateHandle,
    private val convRepo: ConversationRepository,
    private val genRepo: GenerationRepository,
    private val prefs: AppPreferences,
    private val providerRepo: ProviderRepository,
) : ViewModel() {
    private val conversationId: Long = savedState.get<String>("convId")?.toLongOrNull() ?: 0L
    val messages: StateFlow<List<Message>> = convRepo.observeMessages(conversationId).stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val activeSize: StateFlow<ImageSize> = prefs.defaultSize.stateIn(viewModelScope, SharingStarted.Eagerly, ImageSize.DEFAULT)
    val activeProvider: StateFlow<ProviderPreset?> = providerRepo.observe().stateIn(viewModelScope, SharingStarted.Eagerly, null)
    private val _sending = MutableStateFlow(false); val sending: StateFlow<Boolean> = _sending
    fun setSize(size: ImageSize) { viewModelScope.launch { prefs.setDefaultSize(size) } }
    fun send(prompt: String, editSourceMessageId: Long? = null) {
        val trimmed = prompt.trim(); if (trimmed.isEmpty()) return
        val size = activeSize.value
        viewModelScope.launch {
            _sending.value = true
            try {
                convRepo.appendMessage(conversationId, MessageRole.USER,
                    if (editSourceMessageId != null) MessageKind.IMAGE_EDIT_REQUEST else MessageKind.TEXT_PROMPT,
                    trimmed, size, null, MessageStatus.PENDING)
                genRepo.generate(conversationId, trimmed, size, editSourceMessageId)
            } finally { _sending.value = false }
        }
    }
    fun retry(messageId: Long) { viewModelScope.launch { val m = convRepo.getMessage(messageId) ?: return@launch; val p = m.prompt ?: return@launch; send(p) } }
}
```

- [ ] **Step 4: Write `MessageBubble.kt`** — `MessageBubble(message, onImageClick, onRetry, onEdit)` dispatcher. For USER: right-aligned text + optional image thumbnail (Coil AsyncImage, 120dp, rounded). For ASSISTANT IMAGE_RESULT: left-aligned Card with:
  - `PENDING`/`GENERATING`: CircularProgressIndicator + "正在创作…" placeholder (200dp tall)
  - `SUCCESS`: Coil `AsyncImage` (prefer `File(imageLocalPath)` then `remoteImageUrl`); Row with [保存] [编辑] buttons below
  - `FAILED`: red border Card with `Text(errorCode)` + "重试" button (only when retryable; Task 19 wires the retry logic)

- [ ] **Step 5: Replace `ChatRoute.kt`**
```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatRoute(conversationId: Long, onBack: () -> Unit, vm: ChatViewModel = hiltViewModel()) {
    val messages by vm.messages.collectAsState()
    val size by vm.activeSize.collectAsState()
    val provider by vm.activeProvider.collectAsState()
    Scaffold(
        topBar = { TopAppBar(title = { Text("会话 #$conversationId") }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, null) } }) }
    ) { inner ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(inner)) {
            items(messages, key = { it.id }) { m ->
                MessageBubble(message = m, onImageClick = { /* TODO Task 18 */ }, onRetry = vm::retry, onEdit = { /* TODO Task 17 */ })
            }
        }
    }
    // Composer + status bar wired in Task 17.
}
```

- [ ] **Step 6: Verify tests + build.**

- [ ] **Step 7: Commit** — `git commit -m "feat(ui): Chat message list + bubbles + status placeholder"`

---

### Task 17: Chat composer + parameter sheet + provider switcher status bar

**Files:**
- Modify: `app/src/main/kotlin/com/image2chat/app/ui/chat/ChatRoute.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/ui/chat/ChatComposer.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/ui/chat/ChatStatusBar.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/ui/chat/ParamSheet.kt`

- [ ] **Step 1: Write `ChatComposer.kt`** — bottom-anchored Row with attachment IconButton (📎 placeholder for image picker — wired in Task 19), `OutlinedTextField` for prompt, "发送" `FilledIconButton`. Local `mutableStateOf<String>` for input text; on send calls `vm.send(text)` and clears text.

- [ ] **Step 2: Write `ChatStatusBar.kt`** — Row above composer: left "当前: ${provider.name} ▾", right "尺寸: ${size.label} ▾". Tap left → opens `ProviderMenu` (ModalBottomSheet listing all providers via `providerRepo.observe()`); tap right → opens `ParamSheet`.

- [ ] **Step 3: Write `ParamSheet.kt`** — `ModalBottomSheet` with 7 radio-button rows for `ImageSize.entries`. Default selection = `vm.activeSize.value`. On select calls `vm.setSize(size)` and dismisses sheet. Restricted to provider's `supportedSizes()` via `ProviderRegistry.adapterFor(provider.type).supportedSizes()`.

- [ ] **Step 4: Update `ChatViewModel.kt`** — add `val providers: StateFlow<List<ProviderPreset>>` (from `providerRepo.observe()`) and `fun switchProvider(id)` calling `prefs.setSelectedProviderId(id)`.

- [ ] **Step 5: Wire `ChatRoute.kt`** — Stack Column: LazyColumn (messages, weighted) + ChatStatusBar + ChatComposer.

- [ ] **Step 6: Verify tests + build.**

- [ ] **Step 7: Commit** — `git commit -m "feat(ui): Chat composer + parameter sheet + provider switcher"`

---

### Task 18: Image viewer dialog + save/share/copy

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/ui/viewer/ImageViewerDialog.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/ui/viewer/ImageActions.kt`
- Modify: `ChatRoute.kt` — on `MessageBubble.onImageClick(localPath)`, show `ImageViewerDialog`.

- [ ] **Step 1: Write `ImageActions.kt`**
```kotlin
class ImageActions(private val context: Context) {
    fun saveToGallery(file: File): Result<Uri> = runCatching {
        val values = ContentValues().apply { put(MediaStore.MediaColumns.DISPLAY_NAME, file.name); put(MediaStore.MediaColumns.MIME_TYPE, "image/png"); put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/image2chat") }
        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: error("insert failed")
        resolver.openOutputStream(uri)!!.use { out -> file.inputStream().use { it.copyTo(out) } }
        uri
    }
    fun share(file: File) { val uri = androidx.core.content.FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file); val intent = Intent(Intent.ACTION_SEND).apply { type = "image/png"; putExtra(Intent.EXTRA_STREAM, uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) }; context.startActivity(Intent.createChooser(intent, "分享图片")) }
    fun copyPrompt(text: String) { val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager; cm.setPrimaryClip(ClipData.newPlainText("prompt", text)) }
}
```

- [ ] **Step 2: Add FileProvider to `AndroidManifest.xml`**
```xml
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.fileprovider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths" />
</provider>
```
Create `app/src/main/res/xml/file_paths.xml`:
```xml
<paths>
    <files-path name="generated" path="generated/" />
</paths>
```

- [ ] **Step 3: Provide `ImageActions` via Hilt** — add to `RepoModule.kt`: `@Provides fun provideImageActions(@ApplicationContext ctx: Context) = ImageActions(ctx)`.

- [ ] **Step 4: Write `ImageViewerDialog.kt`** — `@Composable fun ImageViewerDialog(file: File, onDismiss, onSave, onShare, onCopyPrompt?, promptText?)` using `Dialog` + pinch-zoom (`pointerInput` with `detectTransformGestures` for scale/offset; cap scale 1f–4f). Top action Row: 保存, 分享, 复制 prompt.

- [ ] **Step 5: Wire in `ChatRoute.kt`** — local `selectedImage: File?` state; pass `onImageClick = { path -> selectedImage = File(path) }` to MessageBubble; render `selectedImage?.let { ImageViewerDialog(...) }`.

- [ ] **Step 6: Verify build** — `./gradlew assembleDebug`.

- [ ] **Step 7: Commit** — `git commit -m "feat(ui): full-screen image viewer + save/share/copy"`

---

### Task 19: Settings screen + retry button visibility + image-pick permission

**Files:**
- Create: `app/src/main/kotlin/com/image2chat/app/ui/settings/SettingsRoute.kt`
- Create: `app/src/main/kotlin/com/image2chat/app/ui/settings/SettingsViewModel.kt`
- Modify: `ChatRoute.kt` — wire `onEdit` callback (select last AI message's local path → enters edit mode in composer)

- [ ] **Step 1: Write `SettingsViewModel.kt`** — exposes `providers: StateFlow<List<ProviderPreset>>`; `fun addCustom(name, url, key)`; `fun delete(id)`; `fun updateKey(id, newKey)`.

- [ ] **Step 2: Write `SettingsRoute.kt`** — list of provider cards with Edit (Key) and Delete (built-in not deletable) actions; "添加自定义" button → simple dialog with name/url/key fields calling `vm.addCustom(...)`.

- [ ] **Step 3: Add Settings entry** — Add a "Settings" `IconButton` to `ChatRoute.kt` TopAppBar that navigates to `Routes.SETTINGS = "settings"`. Add the `composable` to `AppEntry.kt`.

- [ ] **Step 4: Wire retry button visibility** — Update `MessageBubble.kt`: for `MessageStatus.FAILED`, compute `retryable = errorCode == null || errorCode in listOf("0", "500", "429")`; if not retryable and errorCode == "401" show "去设置更新密钥" instead of "重试".

- [ ] **Step 5: Wire image picker** — In `ChatComposer.kt`, the 📎 button launches `rememberLauncherForActivityResult(GetContent())` ("image/*"); on result, copy the picked image to `filesDir/edit_src_<timestamp>.png` and set composer to edit mode (`var editSource by remember { mutableStateOf<Long?>(null) }`); show thumbnail above the field when edit mode active.

- [ ] **Step 6: Verify tests + build.**

- [ ] **Step 7: Commit** — `git commit -m "feat(ui): Settings screen + retry semantics + image picker"`

---

## Phase 4 — E2E

### Task 20: Maestro end-to-end smoke flow

**Files:**
- Create: `.maestro/onboarding-and-generate.yaml`

- [ ] **Step 1: Write `.maestro/onboarding-and-generate.yaml`**
```yaml
appId: com.image2chat.app
---
- launchApp
- tapOn: "开始使用"
- tapOn: "Packy"
- inputText: "sk-test-fake"
- tapOn: "完成"
- assertVisible: "新对话"
- tapOn: "新对话"
- inputText: "a red apple on a wooden table"
- tapOn: "发送"
- assertVisible: "正在创作…"
- assertVisible: "保存"
```

- [ ] **Step 2: Document run command** — add to `README.md`:
```
maestro test .maestro/onboarding-and-generate.yaml
```

- [ ] **Step 3: Commit** — `git commit -m "test(e2e): maestro smoke flow for onboarding + generate"`

---

## Self-Review Notes

- **Spec coverage:** scope ✓ (MVP), data model ✓, UI ✓, network ✓, errors ✓, testing ✓ — all 9 spec sections mapped to tasks.
- **Type consistency:** `ProviderPreset` (data class in `ProviderRepository.kt`) is used consistently across Tasks 3, 11, 15, 19. `Message`/`Conversation` data classes in `ConversationRepository.kt` used consistently in Tasks 4, 15, 16. `ApiError` sealed class used in Tasks 2, 8, 11. `ImageSize`/`ProviderType` enums used in Tasks 2–19.
- **Placeholders:** No "TBD"/"TODO" in code blocks; any "TODO" appears only in interface stubs that are immediately replaced in the following tasks (e.g. ChatRoute's `onEdit`/`onImageClick` filled in Task 17/18).
- **Ambiguity check:** "Edit mode" semantics are explicit: triggers from AI image's [编辑] button OR composer 📎 picker; both set `editSourceMessageId` on next `send`.