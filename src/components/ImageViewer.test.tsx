import 'fake-indexeddb/auto'
import { render, screen, waitFor } from '@testing-library/react'
import { db } from '@/lib/db'
import { ImageViewer } from './ImageViewer'

beforeEach(async () => { await db.delete(); await db.open() })

it('renders nothing when blobId is null', () => {
  const { container } = render(<ImageViewer blobId={null} onClose={() => {}} />)
  expect(container.firstChild).toBeNull()
})

it('renders image after loading blob', async () => {
  const id = await db.images.add({ blob: new Blob([new Uint8Array([0x89, 0x50])], { type: 'image/png' }), mimeType: 'image/png', createdAt: 0 })
  render(<ImageViewer blobId={id} onClose={() => {}} />)
  await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument())
})

it('image is constrained to viewport (object-contain)', async () => {
  const id = await db.images.add({ blob: new Blob([new Uint8Array([0x89, 0x50])], { type: 'image/png' }), mimeType: 'image/png', createdAt: 0 })
  render(<ImageViewer blobId={id} onClose={() => {}} />)
  await waitFor(() => {
    const img = screen.getByRole('img')
    expect(img.className).toContain('object-contain')
  })
})