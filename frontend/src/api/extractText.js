// Client-side text extraction. Loaded lazily so PDF.js (~300 KB) is only
// fetched when the user actually uploads a PDF.

let pdfjsPromise = null

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      return pdfjs
    })()
  }
  return pdfjsPromise
}

export async function extractPdfText(file, onProgress) {
  const pdfjs = await loadPdfjs()
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer,
    isEvalSupported: false,
    disableFontFace: true,
  })
  const pdf = await loadingTask.promise
  try {
    const pages = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item) => (item && typeof item.str === 'string' ? item.str : ''))
        .join(' ')
      if (pageText.trim()) pages.push(pageText)
      page.cleanup()
      if (onProgress) onProgress(i / pdf.numPages)
    }
    const text = pages.join('\n')
    if (!text.trim()) {
      throw new Error('No extractable text — the PDF may be image-only or scanned.')
    }
    return text
  } finally {
    await pdf.destroy()
  }
}

export async function extractTxtText(file) {
  const text = await file.text()
  if (!text.trim()) {
    throw new Error('The text file is empty.')
  }
  return text
}
