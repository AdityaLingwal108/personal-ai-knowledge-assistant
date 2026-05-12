import React, { useEffect, useCallback, useRef } from 'react'
import { clearChat } from '../api/client.js'

export default function SettingsModal({
  apiKey,
  topK,
  onApiKeyChange,
  onTopKChange,
  onClearChat,
  onClose,
}) {
  const backdropRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleBackdropClick = useCallback(
    (e) => {
      if (e.target === backdropRef.current) onClose()
    },
    [onClose]
  )

  const handleClearChat = useCallback(async () => {
    try {
      await clearChat()
    } catch {
      // stateless endpoint — ignore network errors
    }
    onClearChat()
    onClose()
  }, [onClearChat, onClose])

  const sliderPct = ((topK - 2) / 8) * 100

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ backgroundColor: '#111111', border: '1px solid #222' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: '#1f1f1f' }}
        >
          <h2 className="text-base font-semibold" style={{ color: '#e5e5e5' }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-gray-800"
            aria-label="Close settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="#6b7280" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* API Key */}
          <div>
            <label
              htmlFor="api-key"
              className="block text-sm font-medium mb-2"
              style={{ color: '#e5e5e5' }}
            >
              Groq API Key
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="AIza…"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
              style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #2a2a2a',
                color: '#e5e5e5',
                caretColor: '#2563eb',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
              onBlur={(e) => (e.target.style.borderColor = '#2a2a2a')}
            />
            <p className="text-xs mt-2 leading-relaxed" style={{ color: '#6b7280' }}>
              Get a free key at{' '}
              <a
                href="https://console.groq.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#2563eb' }}
                className="underline"
              >
                console.groq.com
              </a>{' '}
              → Sign in → API Keys → Create API Key (free, no credit card)
            </p>
          </div>

          {/* Top-K Slider */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium" style={{ color: '#e5e5e5' }}>
                Context Sources (Top-K)
              </label>
              <span
                className="text-sm font-semibold tabular-nums px-2 py-0.5 rounded-md"
                style={{ backgroundColor: '#1a1a1a', color: '#2563eb' }}
              >
                {topK}
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={10}
              value={topK}
              onChange={(e) => onTopKChange(parseInt(e.target.value))}
              className="w-full"
              style={{
                background: `linear-gradient(to right, #2563eb ${sliderPct}%, #2a2a2a ${sliderPct}%)`,
              }}
              aria-label="Top-K context sources"
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-xs" style={{ color: '#4b5563' }}>2 sources</span>
              <span className="text-xs" style={{ color: '#4b5563' }}>10 sources</span>
            </div>
            <p className="text-xs mt-2" style={{ color: '#6b7280' }}>
              How many document chunks to retrieve per query. Higher = more context, slower response.
            </p>
          </div>
        </div>

        {/* Clear chat */}
        <div
          className="px-6 py-4 border-t"
          style={{ borderColor: '#1f1f1f' }}
        >
          <button
            onClick={handleClearChat}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              backgroundColor: '#1a1a1a',
              color: '#ef4444',
              border: '1px solid #2a2a2a',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2a1010'
              e.currentTarget.style.borderColor = '#7f1d1d'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1a1a1a'
              e.currentTarget.style.borderColor = '#2a2a2a'
            }}
          >
            Clear Chat History
          </button>
        </div>
      </div>
    </div>
  )
}
