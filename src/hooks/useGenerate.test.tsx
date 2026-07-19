// @vitest-environment node
import 'fake-indexeddb/auto'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { db } from '@/lib/db'
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

it('edit mode calls editImage with source blob and persists new image', async () => {
  server.use(http.post('https://www.packyapi.com/v1/images/edits', () =>
    HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] }),
  ))
  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })
  const sourceBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
  const sourceImgId = await db.images.add({ blob: sourceBlob, mimeType: 'image/png', createdAt: 0 })
  const sourceMsgId = await db.messages.add({
    conversationId: cid, role: 'assistant', kind: 'image_result',
    size: '2048x1152', status: 'success', imageBlobId: sourceImgId, createdAt: 0,
  })

  const { generate } = useGenerate()
  const res = (await generate(cid, 'make red', '2048x1152', sourceMsgId)) as { messageId: number }
  expect(res?.messageId).toBeGreaterThan(0)
  const msgs = (await db.messages.toArray()).filter((m) => m.id !== sourceMsgId)
  expect(msgs).toHaveLength(2)
  expect(msgs[0].kind).toBe('image_edit_request')
  expect(msgs[1].status).toBe('success')
  expect(msgs[1].imageBlobId).toBeGreaterThan(0)
})

it('upload source calls editImage without a stored source message', async () => {
  server.use(http.post('https://www.packyapi.com/v1/images/edits', () =>
    HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] }),
  ))
  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })
  const uploadBlob = new Blob([new Uint8Array([4, 5, 6])], { type: 'image/jpeg' })

  const { generate } = useGenerate()
  const res = (await generate(cid, 'edit upload', '1024x1024', undefined, uploadBlob)) as { messageId: number }
  expect(res.messageId).toBeGreaterThan(0)
  const msgs = await db.messages.toArray()
  const assistant = msgs.find((m) => m.role === 'assistant')!
  const user = msgs.find((m) => m.role === 'user')!
  expect(assistant.status).toBe('success')
  expect(assistant.imageBlobId).toBeGreaterThan(0)
  expect(user.kind).toBe('image_edit_request')
  expect(user.imageBlobId).toBeGreaterThan(0)
  expect(user.imageBlobId).not.toBe(assistant.imageBlobId)
})

it('chat edit request stores source imageBlobId on the user message', async () => {
  server.use(http.post('https://www.packyapi.com/v1/images/edits', () =>
    HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] }),
  ))
  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })
  const sourceBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
  const sourceImgId = await db.images.add({ blob: sourceBlob, mimeType: 'image/png', createdAt: 0 })
  const sourceMsgId = await db.messages.add({
    conversationId: cid, role: 'assistant', kind: 'image_result',
    size: '2048x1152', status: 'success', imageBlobId: sourceImgId, createdAt: 0,
  })

  const { generate } = useGenerate()
  await generate(cid, 'make red', '2048x1152', sourceMsgId)
  const user = (await db.messages.toArray()).find((m) => m.role === 'user' && m.kind === 'image_edit_request')!
  expect(user.imageBlobId).toBe(sourceImgId)
})

it('text prompt leaves user imageBlobId undefined', async () => {
  server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
    HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] }),
  ))
  const pid = await db.providers.add({ name: 'P', baseUrl: 'https://www.packyapi.com', apiKey: 'k', type: 'packy', isBuiltIn: 0, createdAt: 0 })
  const cid = await db.conversations.add({ title: 'c', createdAt: 0, updatedAt: 0, providerPresetId: pid })

  const { generate } = useGenerate()
  await generate(cid, 'just text', '1024x1024')
  const user = (await db.messages.toArray()).find((m) => m.role === 'user')!
  expect(user.kind).toBe('text_prompt')
  expect(user.imageBlobId).toBeUndefined()
})
