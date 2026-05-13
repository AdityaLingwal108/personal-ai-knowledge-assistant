# Cortex

A production-quality RAG (Retrieval-Augmented Generation) system. Upload your notes, PDFs, research papers, and documents, then have a natural conversation with your entire knowledge base.

## Tech Stack

- **Backend:** Python 3.11+, FastAPI, sentence-transformers (all-MiniLM-L6-v2), FAISS, Groq (llama-3.3-70b-versatile)
- **Frontend:** React 18, Vite, Tailwind CSS, Axios
- **Persistence:** FAISS index + JSON chunk store on disk (survives restarts)

---

## Setup & Run

### Prerequisites

- Python 3.11 or newer
- Node.js 18 or newer
- A free Groq API key (instructions below)

---

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**First run only:** `all-MiniLM-L6-v2` (~90 MB) downloads automatically from HuggingFace. Subsequent starts are instant.

The backend creates `backend/data/` and `backend/data/documents/` automatically.

---

### Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:5173**

---

### Groq API Key (Free)

1. Go to **https://console.groq.com**
2. Sign up with Google or email — no credit card needed
3. Click **API Keys** → **Create API Key**
4. Copy the key (starts with `gsk_`)
5. In the app, click the **gear icon ⚙** in the top-left sidebar
6. Paste your key — it's saved to `localStorage` (never sent to anyone except Groq's API)

---

## Usage

1. Start both servers (backend on :8000, frontend on :5173)
2. Open **http://localhost:5173**
3. Enter your Groq API key in Settings (gear icon)
4. **Upload documents** via the sidebar — PDF, DOCX, or TXT files
5. Start asking questions — answers are synthesized from your documents with source citations

### Tips

- Upload multiple files at once or drag & drop onto the sidebar
- Each document shows its chunk count so you can see how much was indexed
- Use the **Top-K** slider in Settings to control how many context chunks feed each answer (higher = richer answers, slightly slower)
- Conversation history (last 10 turns) is included for follow-up questions
- If the AI can't find an answer in your documents, it explicitly says so rather than guessing

---

## Architecture

```
Upload flow:
  File → saved to data/documents/
       → parsed (PDF via pypdf, DOCX via python-docx, TXT natively)
       → chunked (600 chars, 120-char overlap, min 50 chars)
       → embedded (all-MiniLM-L6-v2, 384-dim, L2-normalized)
       → added to FAISS IndexFlatIP (incremental, no rebuild)
       → persisted: data/faiss.index + data/chunks.json

Query flow:
  Question → embedded → FAISS cosine search → top-K chunks retrieved
           → context block + conversation history → Groq (llama-3.3-70b-versatile)
           → response + citations displayed in chat UI
```

## Data Persistence

All indexed data lives in `backend/data/`:

| Path | Contents |
|------|----------|
| `data/faiss.index` | FAISS vector index |
| `data/chunks.json` | Chunk text, source filename, chunk ID |
| `data/documents/` | Original uploaded files |

Restarting the backend loads everything from disk automatically — no need to re-upload.
