export interface GenerateRequest {
  model?: string
  prompt: string
  n?: number
  size: string
  quality?: string
  response_format?: 'url' | 'b64_json'
  user?: string
}

export interface ImageData {
  url?: string
  b64_json?: string
  revised_prompt?: string
}

export interface GenerateResponse {
  created: number
  data: ImageData[]
}