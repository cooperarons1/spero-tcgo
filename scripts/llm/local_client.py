"""
Thin httpx wrapper around Ollama for the Llama-distillation pipeline.

Mirrors the shape of coopbot's src/llm/local-client.ts so the two LLM
clients in the user's portfolio stay consistent. Used by:
  - scripts/llama_label_positions.py — labels disagreement positions
  - any future spero-tcgo Python script that needs a local LLM call

Defaults
--------
  Endpoint:  OLLAMA_HOST env var, fallback http://127.0.0.1:11434
  Model:     LLAMA_TEACHER_MODEL env var, fallback "llama3.1:70b"
  Timeout:   180 s per call (long enough for 70B cold-start + ~50 tokens)

Concurrency
-----------
Use asyncio.Semaphore(4) at the call site. Ollama serializes most decode
work on the M5 GPU, so 4 in-flight requests is the sweet spot — more
contend with each other and increase tail latency without raising
throughput. Empirically ~600-900 labels/min at 4-way concurrency.

Model provenance
----------------
Locked to Meta and Mistral models. The hard-coded blocklist refuses
qwen / deepseek / yi / internlm / chatglm even if explicitly requested,
matching the user's project-wide preference (see
~/.claude/projects/-Users-cooperarons/memory/feedback_no_chinese_models.md).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import httpx


OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
LLAMA_TEACHER_MODEL = os.environ.get("LLAMA_TEACHER_MODEL", "llama3.1:70b")

_BLOCKED_PROVIDERS = (
    "qwen", "qwen2", "qwen3",
    "deepseek",
    "yi-",
    "internlm", "internvl",
    "chatglm", "glm-4",
    "baichuan",
    "hunyuan",
    "minicpm",
    "cogvlm",
)


def _check_model_allowed(model: str) -> None:
    """Refuse to call any model whose name matches the Chinese-origin
    blocklist. Hard preference per the project's model-provenance rule."""
    lower = model.lower()
    for blocked in _BLOCKED_PROVIDERS:
        if blocked in lower:
            raise SystemExit(
                f"Refusing to call model '{model}' — Chinese-origin LLMs "
                f"are excluded (matched substring: {blocked!r}). Use "
                f"llama3.1:70b, llama3.3:70b, or mistral-large instead."
            )


class LocalLLMUnavailable(RuntimeError):
    """Raised when Ollama can't be reached or returns a non-200. The
    labeling script should treat this as 'skip this position' rather
    than crashing the whole batch."""


@dataclass
class ChatResponse:
    """Slim wrapper around Ollama's /api/chat response. We only care about
    `text` for the labeling pipeline; the rest is for diagnostics."""
    text: str
    model: str
    eval_count: int = 0
    eval_duration_ns: int = 0


async def probe_ollama(model: Optional[str] = None, timeout: float = 3.0) -> bool:
    """
    Fast liveness probe — does the configured Ollama host respond AND have
    the requested model pulled? 3-second timeout, fail-closed.

    Use this before starting a long labeling run so we fail loudly with
    a clear error rather than hitting 5,000 individual request errors.
    """
    target = model or LLAMA_TEACHER_MODEL
    try:
        async with httpx.AsyncClient(timeout=timeout) as http:
            resp = await http.get(f"{OLLAMA_HOST}/api/tags")
            if resp.status_code != 200:
                return False
            data = resp.json()
            models = data.get("models", [])
            return any(
                m.get("name") == target or m.get("name", "").startswith(target)
                for m in models
            )
    except Exception:
        return False


async def chat_local(
    *,
    system_prompt: str,
    user_prompt: str,
    model: Optional[str] = None,
    timeout: float = 180.0,
    num_predict: int = 32,
    temperature: float = 0.0,
    seed: Optional[int] = None,
) -> ChatResponse:
    """
    Single-turn chat against the local Ollama. The labeling pipeline only
    needs short structured outputs (a single 'SCORE: 0.XX' line), so we
    cap num_predict aggressively to drop per-call latency from ~5-10s to
    ~2-3s.

    temperature=0.0 + optional seed make the call deterministic so a
    re-run produces the same labels (useful for debugging label drift).

    Raises LocalLLMUnavailable on any network or HTTP error so the caller
    can skip the position cleanly.
    """
    target_model = model or LLAMA_TEACHER_MODEL
    _check_model_allowed(target_model)

    payload: dict = {
        "model": target_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": num_predict,
        },
    }
    if seed is not None:
        payload["options"]["seed"] = seed

    try:
        async with httpx.AsyncClient(timeout=timeout) as http:
            resp = await http.post(f"{OLLAMA_HOST}/api/chat", json=payload)
            if resp.status_code != 200:
                raise LocalLLMUnavailable(
                    f"Ollama returned {resp.status_code}: {resp.text[:200]}"
                )
            data = resp.json()
    except httpx.TimeoutException as e:
        raise LocalLLMUnavailable(f"Ollama timeout after {timeout}s") from e
    except httpx.RequestError as e:
        raise LocalLLMUnavailable(f"Ollama unreachable: {e}") from e

    msg = data.get("message", {})
    text = msg.get("content", "") if isinstance(msg, dict) else ""
    if not text:
        raise LocalLLMUnavailable("Ollama returned empty content")

    return ChatResponse(
        text=text,
        model=data.get("model", target_model),
        eval_count=int(data.get("eval_count", 0) or 0),
        eval_duration_ns=int(data.get("eval_duration", 0) or 0),
    )
