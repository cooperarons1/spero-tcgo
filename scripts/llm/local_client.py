"""
Thin httpx wrapper around mlx_lm.server for the Gemma 4 distillation pipeline.

Mirrors the shape of coopbot's src/llm/local-client.ts so the two LLM
clients in the user's portfolio stay consistent. Used by:
  - scripts/llama_label_positions.py — labels disagreement positions
  - any future spero-tcgo Python script that needs a local LLM call

Defaults
--------
  Endpoint:  LLM_HOST env var, fallback http://127.0.0.1:8080
  Model:     TEACHER_MODEL env var, fallback "mlx-community/gemma-4-31b-it-4bit"
  Timeout:   180 s per call (long enough for 31B cold-start + ~50 tokens)

Concurrency
-----------
Use asyncio.Semaphore(4) at the call site. mlx_lm.server serializes most
decode work on the M5 GPU, so 4 in-flight requests is the sweet spot — more
contend with each other and increase tail latency without raising
throughput.

Model provenance
----------------
Locked to Meta, Mistral, and Google models. The hard-coded blocklist refuses
qwen / deepseek / yi / internlm / chatglm even if explicitly requested,
matching the user's project-wide preference (see
~/.claude/projects/-Users-cooperarons/memory/feedback_no_chinese_models.md).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

import httpx


LLM_HOST = os.environ.get("LLM_HOST", "http://127.0.0.1:8080")
TEACHER_MODEL = os.environ.get("TEACHER_MODEL", "mlx-community/gemma-4-e4b-it-8bit")

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
                f"gemma-4-31b, llama3.1:70b, or mistral-large instead."
            )


class LocalLLMUnavailable(RuntimeError):
    """Raised when the LLM server can't be reached or returns a non-200.
    The labeling script should treat this as 'skip this position' rather
    than crashing the whole batch."""


@dataclass
class ChatResponse:
    """Slim wrapper around OpenAI-compatible /v1/chat/completions response.
    We only care about `text` for the labeling pipeline; the rest is for
    diagnostics."""
    text: str
    model: str
    eval_count: int = 0
    eval_duration_ns: int = 0


async def probe_server(model: Optional[str] = None, timeout: float = 5.0) -> bool:
    """
    Fast liveness probe — does the configured LLM server respond AND have
    the requested model loaded? 5-second timeout, fail-closed.

    Use this before starting a long labeling run so we fail loudly with
    a clear error rather than hitting 5,000 individual request errors.
    """
    target = model or TEACHER_MODEL
    try:
        async with httpx.AsyncClient(timeout=timeout) as http:
            resp = await http.get(f"{LLM_HOST}/v1/models")
            if resp.status_code != 200:
                return False
            data = resp.json()
            models = data.get("data", [])
            return any(
                m.get("id") == target or m.get("id", "").startswith(target)
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
    Single-turn chat against the local mlx_lm.server. The labeling pipeline
    only needs short structured outputs (a single 'SCORE: 0.XX' line), so we
    cap max_tokens aggressively to drop per-call latency.

    temperature=0.0 makes the call deterministic. The seed parameter is
    accepted for signature compatibility but is not sent to the OpenAI-
    compatible API (mlx_lm.server does not support it).

    Raises LocalLLMUnavailable on any network or HTTP error so the caller
    can skip the position cleanly.
    """
    target_model = model or TEACHER_MODEL
    _check_model_allowed(target_model)

    payload: dict = {
        "model": target_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "stream": False,
        "temperature": temperature,
        "max_tokens": num_predict,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as http:
            resp = await http.post(f"{LLM_HOST}/v1/chat/completions", json=payload)
            if resp.status_code != 200:
                raise LocalLLMUnavailable(
                    f"LLM server returned {resp.status_code}: {resp.text[:200]}"
                )
            data = resp.json()
    except httpx.TimeoutException as e:
        raise LocalLLMUnavailable(f"LLM server timeout after {timeout}s") from e
    except httpx.RequestError as e:
        raise LocalLLMUnavailable(f"LLM server unreachable: {e}") from e

    choices = data.get("choices", [])
    text = choices[0]["message"].get("content", "") if choices else ""
    if not text:
        raise LocalLLMUnavailable("LLM server returned empty content")

    usage = data.get("usage", {})
    return ChatResponse(
        text=text,
        model=data.get("model", target_model),
        eval_count=int(usage.get("completion_tokens", 0)),
        eval_duration_ns=0,
    )
