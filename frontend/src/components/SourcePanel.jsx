import React from 'react'

function RelevanceBar({ score }) {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100)
  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#eab308' : '#6b7280'
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: '#2a2a2a' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs tabular-nums flex-shrink-0" style={{ color: '#6b7280' }}>
        {pct}%
      </span>
    </div>
  )
}

export default function SourcePanel({ chunks, isOpen }) {
  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-in-out"
      style={{ maxHeight: isOpen ? `${chunks.length * 160 + 16}px` : '0px' }}
    >
      {chunks.length > 0 && (
        <div className="mt-2 space-y-2">
          {chunks.map((chunk, i) => (
            <div
              key={i}
              className="p-3 rounded-xl"
              style={{ backgroundColor: '#111111', border: '1px solid #222' }}
            >
              <div className="flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 flex-shrink-0"
                  fill="none"
                  stroke="#6b7280"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <span
                  className="text-xs font-semibold truncate"
                  style={{ color: '#e5e5e5' }}
                  title={chunk.source}
                >
                  {chunk.source}
                </span>
              </div>
              <RelevanceBar score={chunk.score} />
              <p
                className="text-xs mt-2 leading-relaxed"
                style={{
                  color: '#9ca3af',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {chunk.text.length > 200
                  ? chunk.text.slice(0, 200) + '…'
                  : chunk.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
