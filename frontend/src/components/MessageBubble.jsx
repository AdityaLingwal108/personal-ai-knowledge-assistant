import React, { useState } from 'react'
import SourcePanel from './SourcePanel.jsx'

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function isNotFound(text) {
  return text.toLowerCase().includes("i couldn't find this in your documents")
}

export default function MessageBubble({ message }) {
  const [showSources, setShowSources] = useState(false)
  const isUser = message.role === 'user'
  const notFound = !isUser && isNotFound(message.content)

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div style={{ maxWidth: '72%' }}>
          <div
            className="px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap break-words"
            style={{ backgroundColor: '#1d4ed8', color: '#e5e5e5' }}
          >
            {message.content}
          </div>
          <p className="text-right mt-1 text-xs" style={{ color: '#4b5563' }}>
            {formatTime(message.timestamp)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3">
      {/* AI icon */}
      <div
        className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full mt-0.5 text-sm"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        aria-hidden="true"
      >
        ✦
      </div>

      <div className="flex-1 min-w-0" style={{ maxWidth: 'calc(100% - 44px)' }}>
        {/* Bubble */}
        <div
          className="px-4 py-3 rounded-2xl rounded-tl-sm"
          style={{
            backgroundColor: message.isError ? '#1c0a0a' : '#1a1a1a',
            border: message.isError ? '1px solid #7f1d1d' : '1px solid #222',
          }}
        >
          <p
            className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
              notFound ? 'italic' : ''
            }`}
            style={{ color: notFound ? '#9ca3af' : '#e5e5e5' }}
          >
            {message.content}
          </p>
        </div>

        {/* Timestamp + sources toggle */}
        <div className="flex items-center gap-3 mt-1.5 px-1">
          <span className="text-xs" style={{ color: '#4b5563' }}>
            {formatTime(message.timestamp)}
          </span>

          {!message.isError && message.context && message.context.length > 0 && (
            <button
              onClick={() => setShowSources((v) => !v)}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md transition-colors"
              style={{
                color: showSources ? '#2563eb' : '#6b7280',
                backgroundColor: showSources ? '#1e3a5f33' : 'transparent',
              }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {message.context.length} source{message.context.length !== 1 ? 's' : ''}
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${showSources ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Sources */}
        <SourcePanel chunks={message.context || []} isOpen={showSources} />
      </div>
    </div>
  )
}
