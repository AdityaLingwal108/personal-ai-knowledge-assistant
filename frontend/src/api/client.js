import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 120000,
})

export async function uploadDocument(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/api/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function getDocuments() {
  const res = await api.get('/api/documents')
  return res.data
}

export async function deleteDocument(filename) {
  const res = await api.delete(`/api/documents/${encodeURIComponent(filename)}`)
  return res.data
}

export async function sendMessage(query, history, topK, apiKey) {
  const res = await api.post('/api/chat', {
    query,
    history,
    top_k: topK,
    api_key: apiKey,
  })
  return res.data
}

export async function getHealth() {
  const res = await api.get('/api/health')
  return res.data
}

export async function clearChat() {
  const res = await api.delete('/api/chat')
  return res.data
}
