// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { validateApiKey } from './validate'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('validateApiKey', () => {
  it('sends Authorization bearer header and empty prompt', async () => {
    let captured: { headers: Headers; body: string } | null = null
    server.use(http.post('https://www.packyapi.com/v1/images/generations', async ({ request }) => {
      captured = { headers: request.headers, body: await request.text() }
      return HttpResponse.json({ created: 1, data: [] }, { status: 200 })
    }))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-test')
    expect(res.valid).toBe(true)
    expect(captured!.headers.get('authorization')).toBe('Bearer sk-test')
    expect(JSON.parse(captured!.body)).toMatchObject({ prompt: '', model: 'gpt-image-2' })
  })

  it('returns valid on 400 (auth passed, params rejected)', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
      new HttpResponse('{"error":{"message":"prompt required"}}', { status: 400 }),
    ))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-test')
    expect(res.valid).toBe(true)
  })

  it('returns invalid with unauthorized error on 401', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
      new HttpResponse('{"error":{"message":"bad key"}}', { status: 401 }),
    ))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-bad')
    expect(res.valid).toBe(false)
    expect(res.error?.kind).toBe('unauthorized')
  })

  it('returns invalid with an error on 403', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
      new HttpResponse('', { status: 403 }),
    ))
    const res = await validateApiKey('https://www.packyapi.com', 'sk-bad')
    expect(res.valid).toBe(false)
    expect(res.error).toBeDefined()
  })

  it('returns invalid network error on fetch failure', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () => HttpResponse.error()))
    const res = await validateApiKey('https://www.packyapi.com', 'k')
    expect(res.valid).toBe(false)
    expect(res.error?.kind).toBe('network')
  })
})
