// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { validateApiKey } from './validate'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('validateApiKey', () => {
  it('rejects invalid URL format without making a request', async () => {
    const r1 = await validateApiKey('not-a-url', 'sk-test')
    expect(r1.valid).toBe(false)
    expect(r1.error?.message).toMatch(/格式/)

    const r2 = await validateApiKey('ftp://example.com', 'sk-test')
    expect(r2.valid).toBe(false)
    expect(r2.error?.message).toMatch(/格式/)
  })

  it('rejects empty key without making a request', async () => {
    const r = await validateApiKey('https://www.packyapi.com', '   ')
    expect(r.valid).toBe(false)
    expect(r.error?.message).toMatch(/密钥/)
  })

  it('sends Authorization bearer + valid probe body; 200+data → valid', async () => {
    let captured: { headers: Headers; body: string } | null = null
    server.use(http.post('https://www.packyapi.com/v1/images/generations', async ({ request }) => {
      captured = { headers: request.headers, body: await request.text() }
      return HttpResponse.json({ created: 1, data: [{ url: 'https://cdn/x.png' }] }, { status: 200 })
    }))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-test')
    expect(res.valid).toBe(true)
    expect(captured!.headers.get('authorization')).toBe('Bearer sk-test')
    expect(JSON.parse(captured!.body)).toMatchObject({
      model: 'gpt-image-2', prompt: 'a', n: 1, size: '1024x1024', quality: 'low',
    })
  })

  it('200 with b64_json data → valid', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
      HttpResponse.json({ created: 1, data: [{ b64_json: 'aGVsbG8=' }] }, { status: 200 }),
    ))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-test')
    expect(res.valid).toBe(true)
  })

  it('200 with EMPTY data → INVALID (catches permissive relays)', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
      HttpResponse.json({ created: 1, data: [] }, { status: 200 }),
    ))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-bad')
    expect(res.valid).toBe(false)
    expect(res.error?.kind).toBe('content_filtered')
  })

  it('200 with malformed JSON → INVALID', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
      new HttpResponse('not json at all', { status: 200 }),
    ))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-test')
    expect(res.valid).toBe(false)
  })

  it('401 → invalid', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
      new HttpResponse('{"error":{"message":"bad key"}}', { status: 401 }),
    ))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-bad')
    expect(res.valid).toBe(false)
    expect(res.error?.kind).toBe('unauthorized')
  })

  it('403 → invalid', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
      new HttpResponse('', { status: 403 }),
    ))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-bad')
    expect(res.valid).toBe(false)
    expect(res.error).toBeDefined()
  })

  it('400 → invalid (not definitive proof)', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
      new HttpResponse('{"error":{"message":"prompt required"}}', { status: 400 }),
    ))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-test')
    expect(res.valid).toBe(false)
    expect(res.error?.kind).toBe('bad_request')
  })

  it('500 → invalid', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
      new HttpResponse('', { status: 500 }),
    ))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-test')
    expect(res.valid).toBe(false)
    expect(res.error?.kind).toBe('server_error')
  })

  it('network failure (DNS / unreachable) → invalid network error', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () => HttpResponse.error()))
    const res = await validateApiKey('https://www.packyapi.com', 'k')
    expect(res.valid).toBe(false)
    expect(res.error?.kind).toBe('network')
  })
})
