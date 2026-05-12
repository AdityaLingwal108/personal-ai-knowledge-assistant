import React, { useRef, useCallback, useEffect } from 'react'

const LINE_HEIGHT = 24
const MAX_LINES = 5

export default function ChatInput({ onSend, isLoading, disabled }) {
  const textareaRef = useRef(null)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = LINE_HEIGHT * MAX_LINES
    const newHeight = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${newHeight}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [adjustHeight])

  const handleSend = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const value = el.value.trim()
    if (!value || isLoading || disabled) return
    onSend(value)
    el.value = ''
    adjustHeight()
  }, [onSend, isLoading, disabled, adjustHeight])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const canSend = !isLoading && !disabled

  return (
    <div
      className="flex-shrink-0 px-4 py-3 border-t"
      style={{ backgroundColor: '#111111', borderColor: '#1f1f1f' }}
    >
      <div className="max-w-3xl mx-auto">
        <div
          className="flex items-end gap-3 px-4 py-3 rounded-2xl transition-colors"
          style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            onInput={adjustHeight}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            placeholder={
              disabled
                ? 'Upload documents to start chatting…'
                : 'Ask anything about your documents…'
            }
            className="flex-1 resize-none bg-transparent text-sm outline-none leading-6"
            style={{
              color: '#e5e5e5',
              caretColor: '#2563eb',
              minHeight: `${LINE_HEIGHT}px`,
            }}
            aria-label="Chat message input"
          />

          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex-shrink-0 p-2 rounded-xl transition-all duration-150"
            style={{
              backgroundColor: canSend ? '#2563eb' : '#1f1f1f',
              color: canSend ? '#ffffff' : '#4b5563',
              cursor: canSend ? 'pointer' : 'not-allowed',
            }}
            aria-label="Send message"
          >
            {isLoading ? (
              <div
                className="w-4 h-4 border-2 rounded-full animate-spin"
                style={{ borderColor: '#6b7280', borderTopColor: 'transparent' }}
              />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>

        {disabled && (
          <p className="text-center text-xs mt-2" style={{ color: '#4b5563' }}>
            ← Upload documents from the sidebar to begin
          </p>
        )}
      </div>
    </div>
  )
}
