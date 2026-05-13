import React, { useRef, useState, useCallback } from 'react'
import { uploadDocument, deleteDocument } from '../api/client.js'

function FileStatus({ item }) {
  if (item.status === 'uploading') {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#1a1a1a' }}>
        <div
          className="w-3.5 h-3.5 flex-shrink-0 border-2 rounded-full animate-spin"
          style={{ borderColor: '#2563eb', borderTopColor: 'transparent' }}
        />
        <span className="text-xs truncate" style={{ color: '#9ca3af' }}>
          {item.filename}
        </span>
      </div>
    )
  }
  if (item.status === 'success') {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#0f2a1a' }}>
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-xs truncate" style={{ color: '#22c55e' }}>
          {item.filename}
        </span>
      </div>
    )
  }
  if (item.status === 'error') {
    return (
      <div className="px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#1c0a0a' }}>
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="#ef4444" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-xs truncate" style={{ color: '#ef4444' }}>
            {item.filename}
          </span>
        </div>
        {item.error && (
          <p className="text-xs mt-1 pl-5 leading-relaxed" style={{ color: '#9ca3af' }}>
            {item.error}
          </p>
        )}
      </div>
    )
  }
  return null
}

export default function DocumentSidebar({
  documents,
  onDocumentsChange,
  onOpenSettings,
  onClose,
}) {
  const fileInputRef = useRef(null)
  const [uploadItems, setUploadItems] = useState([])
  const [dragging, setDragging] = useState(false)
  const [deletingFile, setDeletingFile] = useState(null)

  const processFiles = useCallback(
    async (files) => {
      const arr = Array.from(files)
      if (!arr.length) return

      const items = arr.map((f) => ({
        id: `${Date.now()}-${Math.random()}`,
        filename: f.name,
        status: 'uploading',
        error: null,
      }))
      setUploadItems((prev) => [...prev, ...items])

      await Promise.all(
        arr.map(async (file, i) => {
          const id = items[i].id
          try {
            await uploadDocument(file)
            setUploadItems((prev) =>
              prev.map((s) => (s.id === id ? { ...s, status: 'success' } : s))
            )
          } catch (err) {
            const msg =
              err.response?.data?.detail || err.message || 'Upload failed'
            setUploadItems((prev) =>
              prev.map((s) =>
                s.id === id ? { ...s, status: 'error', error: msg } : s
              )
            )
          }
        })
      )

      await onDocumentsChange()

      // Auto-clear successful items after 3s
      setTimeout(() => {
        setUploadItems((prev) => prev.filter((s) => s.status !== 'success'))
      }, 3000)
    },
    [onDocumentsChange]
  )

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragging(false)
      processFiles(e.dataTransfer.files)
    },
    [processFiles]
  )

  const handleDelete = useCallback(
    async (filename) => {
      setDeletingFile(filename)
      try {
        await deleteDocument(filename)
        await onDocumentsChange()
      } catch (err) {
        console.error('Delete failed:', err)
      } finally {
        setDeletingFile(null)
      }
    },
    [onDocumentsChange]
  )

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: '#111111', borderRight: '1px solid #1f1f1f' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-4 flex-shrink-0 border-b"
        style={{ borderColor: '#1f1f1f' }}
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="#2563eb" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <span className="font-semibold text-sm" style={{ color: '#e5e5e5' }}>
            Cortex
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg transition-colors hover:bg-gray-800"
            title="Settings"
            aria-label="Open settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="#6b7280" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-gray-800 md:hidden"
            aria-label="Close sidebar"
          >
            <svg className="w-4 h-4" fill="none" stroke="#6b7280" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto py-2">
        {documents.length === 0 && uploadItems.length === 0 ? (
          <div className="flex items-center justify-center h-20 px-4">
            <p className="text-xs text-center" style={{ color: '#4b5563' }}>
              No documents indexed yet
            </p>
          </div>
        ) : (
          <ul className="px-2 space-y-0.5">
            {documents.map((doc) => (
              <li
                key={doc.filename}
                className="group flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors"
                style={{ cursor: 'default' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = '#1a1a1a')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = 'transparent')
                }
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  stroke="#4b5563"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-medium truncate"
                    style={{ color: '#e5e5e5' }}
                    title={doc.filename}
                  >
                    {doc.filename}
                  </p>
                  <p className="text-xs" style={{ color: '#4b5563' }}>
                    {doc.chunk_count} chunk{doc.chunk_count !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(doc.filename)}
                  disabled={deletingFile === doc.filename}
                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1 rounded"
                  aria-label={`Delete ${doc.filename}`}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
                  style={{ color: '#6b7280' }}
                >
                  {deletingFile === doc.filename ? (
                    <div
                      className="w-4 h-4 border rounded-full animate-spin"
                      style={{ borderColor: '#ef4444', borderTopColor: 'transparent' }}
                    />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Upload status items */}
        {uploadItems.length > 0 && (
          <div className="px-2 pt-1 space-y-1">
            {uploadItems.map((item) => (
              <FileStatus key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Upload zone */}
      <div className="flex-shrink-0 p-3 border-t" style={{ borderColor: '#1f1f1f' }}>
        <div
          className="rounded-xl p-3 transition-all duration-200"
          style={{
            border: `2px dashed ${dragging ? '#2563eb' : '#2a2a2a'}`,
            backgroundColor: dragging ? 'rgba(37,99,235,0.08)' : 'transparent',
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.txt,.docx,.doc"
            className="hidden"
            onChange={(e) => {
              processFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex flex-col items-center gap-2 py-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="#6b7280" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            <div className="text-center">
              <p className="text-xs font-medium" style={{ color: '#e5e5e5' }}>
                Upload Documents
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#4b5563' }}>
                PDF, DOCX, TXT · drag & drop
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
