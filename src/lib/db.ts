import Dexie, { type Table } from 'dexie'

export type ProviderType = 'packy' | 'runapi' | 'custom'
export type MessageRole = 'user' | 'assistant'
export type MessageKind = 'text_prompt' | 'image_result' | 'image_edit_request'
export type MessageStatus = 'pending' | 'generating' | 'success' | 'failed'

export interface ProviderPreset {
  id?: number
  name: string
  baseUrl: string
  apiKey: string
  type: ProviderType
  isBuiltIn: 0 | 1
  createdAt: number
  corsProxy?: string
  lastValidatedAt?: number
  lastValid?: 0 | 1
}

export interface Conversation {
  id?: number
  title: string
  createdAt: number
  updatedAt: number
  providerPresetId: number
}

export interface Message {
  id?: number
  conversationId: number
  role: MessageRole
  kind: MessageKind
  prompt?: string
  imageBlobId?: number
  remoteImageUrl?: string
  size?: string
  status: MessageStatus
  errorCode?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
}

export interface ImageBlob {
  id?: number
  blob: Blob
  mimeType: string
  createdAt: number
}

export class Image2ChatDB extends Dexie {
  providers!: Table<ProviderPreset, number>
  conversations!: Table<Conversation, number>
  messages!: Table<Message, number>
  images!: Table<ImageBlob, number>

  constructor() {
    super('image2chat')
    this.version(1).stores({
      providers: '++id, type, createdAt',
      conversations: '++id, updatedAt, providerPresetId',
      messages: '++id, conversationId, createdAt, status',
      images: '++id, createdAt',
    })
    this.version(2).stores({
      providers: '++id, type, createdAt, baseUrl',
      conversations: '++id, updatedAt, providerPresetId',
      messages: '++id, conversationId, createdAt, status',
      images: '++id, createdAt',
    })
    this.version(3).stores({
      providers: '++id, type, createdAt, baseUrl',
      conversations: '++id, updatedAt, providerPresetId',
      messages: '++id, conversationId, createdAt, status',
      images: '++id, createdAt',
    })
    this.version(4).stores({
      providers: '++id, type, createdAt, baseUrl',
      conversations: '++id, updatedAt, providerPresetId',
      messages: '++id, conversationId, createdAt, status',
      images: '++id, createdAt',
    })
  }
}

export const db = new Image2ChatDB()
