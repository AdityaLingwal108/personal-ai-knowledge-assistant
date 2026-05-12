import React, { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble.jsx'
import EmptyState from './EmptyState.jsx'

export default function ChatWindow({ messages, isLoading, hasDocuments }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ backgroundColor: '#0a0a0a' }}
    >
      {messages.length === 0 && !isLoading ? (
        <div className="h-full">
          <EmptyState hasDocuments={hasDocuments} />
        </div>
      ) : (
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div
                className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-sm"
                style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
                aria-hidden="true"
              >
                ✦
              </div>
              <div
                className="px-4 py-3.5 rounded-2xl rounded-tl-sm"
                style={{ backgroundColor: '#1a1a1a', border: '1px solid #222' }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="typing-dot w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: '#4b5563' }}
                  />
                  <span
                    className="typing-dot w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: '#4b5563' }}
                  />
                  <span
                    className="typing-dot w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: '#4b5563' }}
                  />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
