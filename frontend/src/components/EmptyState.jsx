import React from 'react'

export default function EmptyState({ hasDocuments }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center px-8 max-w-sm">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #222' }}
        >
          {hasDocuments ? (
            <svg className="w-8 h-8" fill="none" stroke="#2563eb" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          ) : (
            <svg className="w-8 h-8" fill="none" stroke="#4b5563" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          )}
        </div>

        {hasDocuments ? (
          <>
            <h3 className="text-base font-semibold mb-2" style={{ color: '#e5e5e5' }}>
              Your knowledge base is ready
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>
              Ask anything about your documents — I'll synthesize answers from everything you've uploaded and cite my sources.
            </p>
          </>
        ) : (
          <>
            <h3 className="text-base font-semibold mb-2" style={{ color: '#e5e5e5' }}>
              Upload your documents to get started
            </h3>
            <p className="text-sm leading-relaxed mb-5" style={{ color: '#6b7280' }}>
              Add PDFs, Word documents, or text files to build your personal knowledge base.
            </p>
            <div className="flex items-center justify-center gap-2" style={{ color: '#4b5563' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm">Use the sidebar to upload</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
