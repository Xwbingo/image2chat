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

  it('probes GET /v1/models with bearer header; 200 → valid', async () => {
    let captured: { method: string; path: string; headers: Headers } | null = null
    server.use(http.get('https://www.packyapi.com/v1/models', ({ request }) => {
      captured = { method: request.method, path: new URL(request.url).pathname, headers: request.headers }
      return HttpResponse.json({ object: 'list', data: [{ id: 'gpt-image-2' }] })
    }))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-test')
    expect(res.valid).toBe(true)
    expect(captured!.method).toBe('GET')
    expect(captured!.path).toBe('/v1/models')
    expect(captured!.headers.get('authorization')).toBe('Bearer sk-test')
  })

  it('401 → invalid with unauthorized error', async () => {
    server.use(http.get('https://www.packyapi.com/v1/models', () =>
      new HttpResponse('{"error":{"message":"bad key"}}', { status: 401 }),
    ))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-bad')
    expect(res.valid).toBe(false)
    expect(res.error?.kind).toBe('unauthorized')
  })

  it('403 → invalid', async () => {
    server.use(http.get('https://www.packyapi.com/v1/models', () =>
      new HttpResponse('', { status: 403 }),
    ))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-bad')
    expect(res.valid).toBe(false)
    expect(res.error).toBeDefined()
  })

  it('404 (endpoint not supported) → invalid with explanatory message', async () => {
    server.use(http.get('https://www.packyapi.com/v1/models', () =>
      new HttpResponse('', { status: 404 }),
    ))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-test')
    expect(res.valid).toBe(false)
    expect(res.error?.message).toMatch(/不支持/)
  })

  it('network failure → invalid with network error', async () => {
    server.use(http.get('https://www.packyapi.com/v1/models', () => HttpResponse.error()))
    const res = await validateApiKey('https://www.packyapi.com', 'k')
    expect(res.valid).toBe(false)
    expect(res.error?.kind).toBe('network')
  })
})