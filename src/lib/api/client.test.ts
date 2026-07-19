// @vitest-environment node
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { generateImage, editImage, editImageMulti } from './client'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const IMAGE_B64 = 'iVBORw0KGgo='

describe('generateImage', () => {
  it('POSTs to /v1/images/generations with bearer header', async () => {
    let captured: { headers: Headers; body: string } | null = null
    server.use(http.post('https://www.packyapi.com/v1/images/generations', async ({ request }) => {
      captured = { headers: request.headers, body: await request.text() }
      return HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] })
    }))
    const res = await generateImage('https://www.packyapi.com', 'sk-test', {
      prompt: 'cat', size: '2048x1152',
    })
    expect(res.data[0].b64_json).toBe(IMAGE_B64)
    expect(captured!.headers.get('authorization')).toBe('Bearer sk-test')
    expect(JSON.parse(captured!.body)).toMatchObject({ prompt: 'cat', size: '2048x1152', response_format: 'b64_json' })
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
      return HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] })
    }))
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const res = await editImage('https://www.packyapi.com', 'sk-test', 'make red', blob, '1024x1024')
    expect(res.data[0].b64_json).toBe(IMAGE_B64)
    expect(captured!.get('model')).toBe('gpt-image-2')
    expect(captured!.get('prompt')).toBe('make red')
    expect(captured!.get('size')).toBe('1024x1024')
    expect(captured!.get('response_format')).toBe('b64_json')
    expect(captured!.get('image')).toBeInstanceOf(Blob)
  })
})

describe('editImageMulti', () => {
  it('appends each blob as a separate "image" field in order', async () => {
    let captured: FormData | null = null
    server.use(http.post('https://www.packyapi.com/v1/images/edits', async ({ request }) => {
      captured = await request.formData()
      return HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] })
    }))
    const blobs = [
      new Blob([new Uint8Array([1])], { type: 'image/png' }),
      new Blob([new Uint8Array([2])], { type: 'image/png' }),
      new Blob([new Uint8Array([3])], { type: 'image/png' }),
    ]
    const res = await editImageMulti('https://www.packyapi.com', 'sk-test', 'combine', blobs, '1024x1024')
    expect(res.data[0].b64_json).toBe(IMAGE_B64)
    const images = captured!.getAll('image') as Blob[]
    expect(images).toHaveLength(3)
    // Each FormData entry is wrapped as a File with the source-N filename, so we compare byte content via size + array equality.
    expect(await images[0].arrayBuffer()).toEqual(await blobs[0].arrayBuffer())
    expect(await images[1].arrayBuffer()).toEqual(await blobs[1].arrayBuffer())
    expect(await images[2].arrayBuffer()).toEqual(await blobs[2].arrayBuffer())
    expect(captured!.get('prompt')).toBe('combine')
    expect(captured!.get('size')).toBe('1024x1024')
  })

  it('with empty blobs array still sends a valid form (no images)', async () => {
    let captured: FormData | null = null
    server.use(http.post('https://www.packyapi.com/v1/images/edits', async ({ request }) => {
      captured = await request.formData()
      return HttpResponse.json({ created: 1, data: [{ b64_json: IMAGE_B64 }] })
    }))
    await editImageMulti('https://www.packyapi.com', 'sk-test', 'nope', [], '1024x1024')
    expect(captured!.getAll('image')).toHaveLength(0)
  })
})