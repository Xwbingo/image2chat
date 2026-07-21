import { createBrowserRouter, Navigate } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/c/:conversationId', element: <HomePage /> },
  { path: '*', element: <Navigate to="/" replace /> },
])