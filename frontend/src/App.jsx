import React, { useState, useEffect, useCallback, useReducer } from 'react'
import DocumentSidebar from './components/DocumentSidebar.jsx'
import ChatWindow from './components/ChatWindow.jsx'
import ChatInput from './components/ChatInput.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import { sendMessage, getDocuments, getHealth } from './api/client.js'

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------
const initialState = {
  messages: [],
  documents: [],
  isLoading: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] }
    case 'SET_DOCUMENTS':
      return { ...state, documents: action.payload }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] }
    default:
      return state
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem('gemini_api_key') || ''
  )
  const [topK, setTopK] = useState(
    () => parseInt(localStorage.getItem('top_k') || '5') || 5
  )
  const [showSettings, setShowSettings] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // On mount: load health + documents in parallel
  useEffect(() => {
    Promise.all([
      getHealth().catch(() => null),
      getDocuments().catch(() => ({ documents: [] })),
    ]).then(([, docsData]) => {
      if (docsData?.documents) {
        dispatch({ type: 'SET_DOCUMENTS', payload: docsData.documents })
      }
    })
  }, [])

  const handleApiKeyChange = useCallback((key) => {
    setApiKey(key)
    localStorage.setItem('gemini_api_key', key)
  }, [])

  const handleTopKChange = useCallback((k) => {
    setTopK(k)
    localStorage.setItem('top_k', String(k))
  }, [])

  const refreshDocuments = useCallback(async () => {
    try {
      const data = await getDocuments()
      dispatch({ type: 'SET_DOCUMENTS', payload: data.documents })
    } catch {
      // silently skip — sidebar will show stale data until next refresh
    }
  }, [])

  const handleSendMessage = useCallback(
    async (query) => {
      if (!query.trim() || state.isLoading) return

      const userMsg = {
        id: uid(),
        role: 'user',
        content: query,
        context: [],
        timestamp: new Date().toISOString(),
      }
      dispatch({ type: 'ADD_MESSAGE', payload: userMsg })
      dispatch({ type: 'SET_LOADING', payload: true })

      // Build history from messages already in state (before this turn)
      const history = state.messages
        .slice(-10)
        .map(({ role, content }) => ({ role, content }))

      try {
        const result = await sendMessage(query, history, topK, apiKey)
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            id: uid(),
            role: 'assistant',
            content: result.response,
            context: result.context || [],
            timestamp: new Date().toISOString(),
            isError: false,
          },
        })
      } catch (err) {
        const detail =
          err.response?.data?.detail ||
          err.message ||
          'Something went wrong. Please try again.'
        dispatch({
          type: 'ADD_MESSAGE',
          payload: {
            id: uid(),
            role: 'assistant',
            content: detail,
            context: [],
            timestamp: new Date().toISOString(),
            isError: true,
          },
        })
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    },
    [state.messages, state.isLoading, topK, apiKey]
  )

  const handleClearChat = useCallback(() => {
    dispatch({ type: 'CLEAR_MESSAGES' })
  }, [])

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: '#0a0a0a', color: '#e5e5e5' }}
    >
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:relative z-30 md:z-auto h-full flex-shrink-0 transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ width: '280px' }}
      >
        <DocumentSidebar
          documents={state.documents}
          onDocumentsChange={refreshDocuments}
          onOpenSettings={() => setShowSettings(true)}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Mobile top bar */}
        <div
          className="flex items-center px-4 py-3 md:hidden border-b flex-shrink-0"
          style={{ backgroundColor: '#111111', borderColor: '#1f1f1f' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg mr-3 hover:bg-gray-800 transition-colors"
            aria-label="Open sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-sm">AI Knowledge Assistant</span>
        </div>

        {/* Chat area */}
        <div className="flex-1 min-h-0">
          <ChatWindow
            messages={state.messages}
            isLoading={state.isLoading}
            hasDocuments={state.documents.length > 0}
          />
        </div>

        {/* Input */}
        <ChatInput
          onSend={handleSendMessage}
          isLoading={state.isLoading}
          disabled={state.documents.length === 0}
        />
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          apiKey={apiKey}
          topK={topK}
          onApiKeyChange={handleApiKeyChange}
          onTopKChange={handleTopKChange}
          onClearChat={handleClearChat}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
