from typing import List, Dict
from openai import OpenAI


SYSTEM_INSTRUCTION = (
    "You are Cortex, a precise personal knowledge assistant. "
    "Answer strictly from the provided document context. "
    "Synthesize information across multiple sources when relevant — do not treat each source in isolation. "
    "If the answer is not present in the documents, say clearly: "
    "'I couldn't find this in your documents.' "
    "Never invent facts. Cite which document(s) your answer comes from. "
    "Be concise, direct, and helpful."
)


class CortexModel:
    def __init__(self, model_name: str = "llama-3.3-70b-versatile"):
        self.model_name = model_name

    def generate(
        self,
        query: str,
        context_chunks: List[Dict],
        history: List[Dict],
        api_key: str,
    ) -> str:
        if not api_key or not api_key.strip():
            raise ValueError(
                "Groq API key is required. Please enter your API key in Settings."
            )

        # Build labelled context block
        context_parts = []
        for i, chunk in enumerate(context_chunks):
            context_parts.append(
                f"[Source: {chunk['source']}, Chunk {i + 1}]\n{chunk['text']}"
            )
        context_block = "\n\n---\n\n".join(context_parts)

        # Cap history at last 10 messages
        recent_history = history[-10:]

        # Assemble full prompt
        full_prompt = f"DOCUMENT CONTEXT:\n{context_block}\n\nCURRENT QUESTION: {query}"

        # Build native messages array
        messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]
        for msg in recent_history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        
        messages.append({"role": "user", "content": full_prompt})

        try:
            client = OpenAI(
                api_key=api_key.strip(),
                base_url="https://api.groq.com/openai/v1",
            )
            response = client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.2,
                max_tokens=2048,
            )
            return response.choices[0].message.content
        except Exception as e:
            msg = str(e)
            if any(
                kw in msg.upper()
                for kw in ("INVALID_API_KEY", "UNAUTHORIZED", "AUTHENTICATION", "401", "403")
            ):
                raise ValueError(
                    f"Invalid or unauthorized Grok API key. "
                    f"Please check your key in Settings. Detail: {msg}"
                )
            raise RuntimeError(f"Grok API error: {msg}")
