import { createBrowserRouter } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { SettingsPage } from '@/pages/SettingsPage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/c/:conversationId', element: <HomePage /> },
  { path: '/settings', element: <SettingsPage /> },
])
