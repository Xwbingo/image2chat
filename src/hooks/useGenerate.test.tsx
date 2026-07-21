// @vitest-environment node
import 'fake-indexeddb/auto'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { db, type ImageRef } from '@/lib/db'
import { useGenerate } from './useGenerate'
import React from 'react'

type Dispatcher = {
  useCallback: <T>(cb: T, deps: unknown[]) => T
  useMemo: <T>(cb: () => T, deps: unknown[]) => T
  useState: <S>(initial: S) => [S, (s: S) => void]
  useReducer: <S, A>(r: (s: S, a: A) => S, i: S) => [S, (a: A) => void]
  useEffect: (cb: () => void, deps?: unknown[]) => void
  useRef: <T>(initial: T) => { current: T }
}
const IMAGE_B64 = 'iVBORw0KGgo='

const internals = (React as unknown as {
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
    ReactCurrentDispatcher: { current: Dispatcher | null }
  }
}).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
const passthroughDispatcher: Dispatcher = {
  useCallback: (cb) => cb as never,
  useMemo: (cb) => cb(),
  useState: (initial) => [initial, () => {}],
  useReducer: (_reducer, initial) => [initial, () => {}],
  useEffect: () => {},
  useRef: (initial) => ({ current: initial }),
}
const prevDispatcher = internals.ReactCurrentDispatcher.current
internals.ReactCurrentDispatcher.current = passthroughDispatcher

beforeAll(() => server.listen())
afterEach(async () => { server.resetHandlers(); await db.delete(); await db.open() })
afterAll(() => {
  internals.ReactCurrentDispatcher.current = prevDispatcher
  server.close()
})

it('success path: inserts pending msg, calls API, persists blob, marks success', async () => {
  server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
    HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] }),
  ))

  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })

  const { generate } = useGenerate()
  const res = (await generate(cid, 'cat', '2048x1152')) as { messageId: number }
  expect(res?.messageId).toBeGreaterThan(0)
  const msgs = await db.messages.toArray()
  expect(msgs).toHaveLength(2)
  const assistant = msgs.find((m) => m.role === 'assistant')!
  expect(assistant.status).toBe('success')
  expect(assistant.imageBlobId).toBeGreaterThan(0)
  expect(assistant.remoteImageUrl).toBeUndefined()
})

it('error path: marks message failed with errorCode', async () => {
  server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
    new HttpResponse('', { status: 401 }),
  ))
  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })

  const { generate } = useGenerate()
  const res = (await generate(cid, 'cat', '2048x1152')) as { error: { kind: string } }
  expect(res?.error?.kind).toBe('unauthorized')
  const msgs = await db.messages.toArray()
  const assistant = msgs.find((m) => m.role === 'assistant')!
  expect(assistant.status).toBe('failed')
  expect(assistant.errorCode).toBe('unauthorized')
})

it('chat edit: single ref calls editImageMulti with one blob and persists new image', async () => {
  let capturedForm: FormData | null = null
  server.use(http.post('https://www.packyapi.com/v1/images/edits', async ({ request }) => {
    capturedForm = await request.formData()
    return HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] })
  }))
  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })
  const sourceBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
  const sourceImgId = await db.images.add({ blob: sourceBlob, mimeType: 'image/png', createdAt: 0 })
  const sourceMsgId = await db.messages.add({
    conversationId: cid, role: 'assistant', kind: 'image_result',
    size: '2048x1152', status: 'success', imageBlobId: sourceImgId, createdAt: 0,
  })

  const refs: ImageRef[] = [{ blobId: sourceImgId, kind: 'chat', sourceMsgId }]
  const { generate } = useGenerate()
  const res = (await generate(cid, 'make red', '2048x1152', refs)) as { messageId: number }
  expect(res?.messageId).toBeGreaterThan(0)
  expect(capturedForm!.getAll('image')).toHaveLength(1)
  const msgs = (await db.messages.toArray()).filter((m) => m.id !== sourceMsgId)
  expect(msgs).toHaveLength(2)
  expect(msgs[0].kind).toBe('image_edit_request')
  expect(msgs[0].imageRefs).toEqual(refs)
  expect(msgs[1].status).toBe('success')
  expect(msgs[1].imageBlobId).toBeGreaterThan(0)
})

it('local upload edit: persists blob before sending and stores the new blobId in imageRefs', async () => {
  server.use(http.post('https://www.packyapi.com/v1/images/edits', () =>
    HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] }),
  ))
  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })
  const uploadBlob = new Blob([new Uint8Array([4, 5, 6])], { type: 'image/jpeg' })
  const uploadId = await db.images.add({ blob: uploadBlob, mimeType: 'image/jpeg', createdAt: 0 })

  const refs: ImageRef[] = [{ blobId: uploadId, kind: 'local', fileName: 'kitten.png' }]
  const { generate } = useGenerate()
  const res = (await generate(cid, 'edit upload', '1024x1024', refs)) as { messageId: number }
  expect(res.messageId).toBeGreaterThan(0)
  const msgs = await db.messages.toArray()
  const assistant = msgs.find((m) => m.role === 'assistant')!
  const user = msgs.find((m) => m.role === 'user')!
  expect(assistant.status).toBe('success')
  expect(assistant.imageBlobId).toBeGreaterThan(0)
  expect(user.kind).toBe('image_edit_request')
  expect(user.imageRefs).toEqual(refs)
})

it('multi-ref edit sends images in FormData order matching refs array', async () => {
  let capturedForm: FormData | null = null
  server.use(http.post('https://www.packyapi.com/v1/images/edits', async ({ request }) => {
    capturedForm = await request.formData()
    return HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] })
  }))
  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })

  const blobs = [
    new Blob([new Uint8Array([1])], { type: 'image/png' }),
    new Blob([new Uint8Array([2])], { type: 'image/png' }),
    new Blob([new Uint8Array([3])], { type: 'image/png' }),
  ]
  const ids: number[] = []
  for (const b of blobs) ids.push(await db.images.add({ blob: b, mimeType: 'image/png', createdAt: 0 }))

  const refs: ImageRef[] = [
    { blobId: ids[0], kind: 'local', fileName: 'a.png' },
    { blobId: ids[1], kind: 'chat', sourceMsgId: 99 },
    { blobId: ids[2], kind: 'local', fileName: 'c.png' },
  ]
  const { generate } = useGenerate()
  const res = (await generate(cid, 'combine', '1024x1024', refs)) as { messageId: number }
  expect(res.messageId).toBeGreaterThan(0)
  const sent = capturedForm!.getAll('image') as Blob[]
  expect(sent).toHaveLength(3)
  // FormData wraps each Blob as a File with the source-N filename; compare byte content instead of reference.
  expect(await sent[0].arrayBuffer()).toEqual(await blobs[0].arrayBuffer())
  expect(await sent[1].arrayBuffer()).toEqual(await blobs[1].arrayBuffer())
  expect(await sent[2].arrayBuffer()).toEqual(await blobs[2].arrayBuffer())
  const user = (await db.messages.toArray()).find((m) => m.role === 'user')!
  expect(user.imageRefs).toEqual(refs)
})

it('throws bad_request when a ref blobId is missing', async () => {
  server.use(http.post('https://www.packyapi.com/v1/images/edits', () =>
    HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] }),
  ))
  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })

  const refs: ImageRef[] = [{ blobId: 999999, kind: 'local', fileName: 'missing.png' }]
  const { generate } = useGenerate()
  const res = (await generate(cid, 'edit', '1024x1024', refs)) as { error: { kind: string; message: string } }
  expect(res.error.kind).toBe('bad_request')
  expect(res.error.message).toMatch(/999999/)
})

it('text prompt: no imageRefs field on user message', async () => {
  server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
    HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] }),
  ))
  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })

  const { generate } = useGenerate()
  await generate(cid, 'just text', '1024x1024')
  const user = (await db.messages.toArray()).find((m) => m.role === 'user')!
  expect(user.kind).toBe('text_prompt')
  expect(user.imageRefs).toEqual([])
})

it('success path records startedAt and completedAt for elapsed-time display', async () => {
  server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
    HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] }),
  ))
  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })

  const { generate } = useGenerate()
  await generate(cid, 'timed', '1024x1024')
  const assistant = (await db.messages.toArray()).find((m) => m.role === 'assistant')!
  expect(assistant.startedAt).toBeGreaterThan(0)
  expect(assistant.completedAt).toBeGreaterThan(0)
  expect(assistant.completedAt).toBeGreaterThanOrEqual(assistant.startedAt!)
})

it('failure path records completedAt so elapsed-time still renders', async () => {
  server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
    new HttpResponse('', { status: 500 }),
  ))
  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })

  const { generate } = useGenerate()
  await generate(cid, 'will fail', '1024x1024')
  const assistant = (await db.messages.toArray()).find((m) => m.role === 'assistant')!
  expect(assistant.status).toBe('failed')
  expect(assistant.startedAt).toBeGreaterThan(0)
  expect(assistant.completedAt).toBeGreaterThan(0)
})

it('url response: fetches the image, stores blob, sets remoteImageUrl', async () => {
  const pngBytes = Uint8Array.from(atob(IMAGE_B64), (c) => c.charCodeAt(0))
  server.use(
    http.post('https://www.packyapi.com/v1/images/generations', () =>
      HttpResponse.json({
        created: 1784556537,
        data: [{ revised_prompt: '生成一只猫咪', url: 'https://example.com/test.png' }],
        request_id: 'req-1',
        stage: 'completed',
        status: 'completed',
      }),
    ),
    http.get('https://example.com/test.png', () =>
      new HttpResponse(pngBytes, { headers: { 'content-type': 'image/png' } }),
    ),
  )
  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })

  const { generate } = useGenerate()
  const res = (await generate(cid, 'cat', '2048x1152')) as { messageId: number }
  expect(res?.messageId).toBeGreaterThan(0)
  const assistant = (await db.messages.toArray()).find((m) => m.role === 'assistant')!
  expect(assistant.status).toBe('success')
  expect(assistant.imageBlobId).toBeGreaterThan(0)
  expect(assistant.remoteImageUrl).toBe('https://example.com/test.png')
})