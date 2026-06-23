"""Shared LLM client.

Primary: LiteLLM proxy (model tiering, cost tracking, Langfuse).
Fallback: Anthropic directly when proxy is unavailable (dev mode).
"""

from __future__ import annotations

import json
import logging
from typing import Any

from openai import AsyncOpenAI

from forgeflow.config import settings
from forgeflow.state import ForgeState

log = logging.getLogger(__name__)

# Map internal model aliases → real Anthropic model IDs (used in direct fallback)
_MODEL_MAP = {
    "forge/planner": "claude-sonnet-4-6",
    "forge/worker":  "claude-haiku-4-5-20251001",  # fallback when no Groq
    "forge/judge":   "claude-haiku-4-5-20251001",
}


def get_client(direct: bool = False) -> AsyncOpenAI:
    """Return OpenAI-compatible client.
    direct=True → call Anthropic API directly (no LiteLLM proxy).
    """
    if direct:
        return AsyncOpenAI(
            base_url="https://api.anthropic.com/v1",
            api_key=settings.ANTHROPIC_API_KEY,
            default_headers={"anthropic-version": "2023-06-01"},
        )
    return AsyncOpenAI(
        base_url=settings.LITELLM_PROXY_URL,
        api_key=settings.litellm_api_key or "no-key",
    )


def _resolve_model(model: str, direct: bool) -> str:
    """Resolve forge/xxx alias to real model name when calling Anthropic directly."""
    if direct:
        return _MODEL_MAP.get(model, "claude-haiku-4-5-20251001")
    return model


def _langfuse_meta(state: ForgeState, generation_name: str) -> dict:
    return {
        "metadata": {
            "trace_id": state.run_id,
            "generation_name": generation_name,
            "run_id": state.run_id,
        }
    }


async def chat_json(
    state: ForgeState,
    model: str,
    messages: list[dict],
    generation_name: str,
    temperature: float = 0.2,
) -> tuple[Any, int, float]:
    """Call LLM and return (parsed_dict, tokens_used, cost_usd)."""
    if not state.within_budget():
        raise BudgetExceededError(
            f"Budget cap ${state.budget_cap_usd} reached (used ${state.budget_used_usd:.4f})"
        )

    # Try proxy first, fall back to direct Anthropic on connection error
    for direct in (False, True):
        try:
            client = get_client(direct=direct)
            real_model = _resolve_model(model, direct)
            kwargs: dict[str, Any] = dict(
                model=real_model,
                messages=messages,
                temperature=temperature,
            )
            if not direct:
                kwargs["response_format"] = {"type": "json_object"}
                kwargs["extra_body"] = _langfuse_meta(state, generation_name)

            response = await client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content or "{}"
            tokens = response.usage.total_tokens if response.usage else 0
            cost_usd = _estimate_cost(model, tokens)

            if direct:
                log.info("[_llm] Used Anthropic direct for %s (proxy unavailable)", generation_name)

            try:
                parsed = json.loads(_strip_json(content))
            except json.JSONDecodeError as e:
                log.error("JSON parse error in %s: %s\nRaw: %s", generation_name, e, content[:500])
                raise
            return parsed, tokens, cost_usd

        except BudgetExceededError:
            raise
        except Exception as e:
            if direct:
                # Both proxy and direct failed
                raise
            err_str = str(e).lower()
            if any(x in err_str for x in ("connection", "no_db", "no connected db", "500", "400")):
                log.warning("[_llm] Proxy unavailable (%s), falling back to Anthropic direct", e)
                continue
            raise

    raise RuntimeError("Unreachable")


async def chat_text(
    state: ForgeState,
    model: str,
    messages: list[dict],
    generation_name: str,
    temperature: float = 0.3,
) -> tuple[str, int, float]:
    """Like chat_json but returns raw text."""
    if not state.within_budget():
        raise BudgetExceededError(
            f"Budget cap ${state.budget_cap_usd} reached (used ${state.budget_used_usd:.4f})"
        )

    for direct in (False, True):
        try:
            client = get_client(direct=direct)
            real_model = _resolve_model(model, direct)
            kwargs: dict[str, Any] = dict(
                model=real_model,
                messages=messages,
                temperature=temperature,
            )
            if not direct:
                kwargs["extra_body"] = _langfuse_meta(state, generation_name)

            response = await client.chat.completions.create(**kwargs)
            content = response.choices[0].message.content or ""
            tokens = response.usage.total_tokens if response.usage else 0
            return content, tokens, _estimate_cost(model, tokens)

        except BudgetExceededError:
            raise
        except Exception as e:
            if direct:
                raise
            err_str = str(e).lower()
            if any(x in err_str for x in ("connection", "no_db", "no connected db", "500", "400")):
                log.warning("[_llm] Proxy unavailable, falling back to Anthropic direct")
                continue
            raise

    raise RuntimeError("Unreachable")


def _strip_json(text: str) -> str:
    """Strip markdown code fences from LLM output — models often wrap JSON in ```json ... ```."""
    import re
    text = text.strip()
    # Remove ```json ... ``` or ``` ... ``` wrappers
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        return match.group(1).strip()
    return text


def _estimate_cost(model: str, tokens: int) -> float:
    rates = {
        "forge/planner": 3.0e-6,
        "forge/worker":  0.59e-6,
        "forge/judge":   0.25e-6,
    }
    return round(tokens * rates.get(model, 3.0e-6), 6)


class BudgetExceededError(Exception):
    pass
