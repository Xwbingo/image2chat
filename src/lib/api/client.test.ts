// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { generateImage, editImage } from './client'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('generateImage', () => {
  it('POSTs to /v1/images/generations with bearer header', async () => {
    let captured: { headers: Headers; body: string } | null = null
    server.use(http.post('https://www.packyapi.com/v1/images/generations', async ({ request }) => {
      captured = { headers: request.headers, body: await request.text() }
      return HttpResponse.json({ created: 1, data: [{ url: 'https://cdn/x.png' }] })
    }))
    const res = await generateImage('https://www.packyapi.com', 'sk-test', {
      prompt: 'cat', size: '2048x1152',
    })
    expect(res.data[0].url).toBe('https://cdn/x.png')
    expect(captured!.headers.get('authorization')).toBe('Bearer sk-test')
    expect(JSON.parse(captured!.body)).toMatchObject({ prompt: 'cat', size: '2048x1152' })
  })

  it('throws ApiError with kind=unauthorized on 401', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () =>
      new HttpResponse('', { status: 401 }),
    ))
    await expect(generateImage('https://www.packyapi.com', 'bad', { prompt: 'x', size: '1024x1024' }))
      .rejects.toMatchObject({ kind: 'unauthorized' })
  })

  it('throws ApiError with kind=network on fetch failure', async () => {
    server.use(http.post('https://www.packyapi.com/v1/images/generations', () => HttpResponse.error()))
    await expect(generateImage('https://www.packyapi.com', 'k', { prompt: 'x', size: '1024x1024' }))
      .rejects.toMatchObject({ kind: 'network' })
  })
})

describe('editImage', () => {
  it('POSTs multipart to /v1/images/edits', async () => {
    let captured: FormData | null = null
    server.use(http.post('https://www.packyapi.com/v1/images/edits', async ({ request }) => {
      captured = await request.formData()
      return HttpResponse.json({ created: 1, data: [{ url: 'https://cdn/y.png' }] })
    }))
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const res = await editImage('https://www.packyapi.com', 'sk-test', 'make red', blob, '1024x1024')
    expect(res.data[0].url).toBe('https://cdn/y.png')
    expect(captured!.get('model')).toBe('gpt-image-2')
    expect(captured!.get('prompt')).toBe('make red')
    expect(captured!.get('size')).toBe('1024x1024')
    expect(captured!.get('image')).toBeInstanceOf(Blob)
  })
})