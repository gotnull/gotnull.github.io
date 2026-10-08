"""The model the programs talk to, with a second provider behind the first.

OpenAI is tried first. If it refuses (out of credit, key revoked, an outage
that outlasts the client's own retries), the same request goes to the
fallback: any OpenAI-compatible endpoint, set with GHOST_FALLBACK_BASE_URL,
GHOST_FALLBACK_API_KEY and GHOST_FALLBACK_MODEL (OpenRouter, Anthropic's
OpenAI-compatible endpoint, Gemini's, and so on). A run only gives up when
every provider has refused, and then it says why instead of raising.

    from llm import chat_json, NoModel
    try:
        data = chat_json(system, user, temperature=0.9)
    except NoModel as exc:
        ...  # str(exc) lists each provider and what it said
"""
from __future__ import annotations

import json
import os
import re

MODEL = os.getenv("GHOST_MODEL", "gpt-4o")


class NoModel(Exception):
    """Every provider refused. The message lists each one and its reason."""


def providers() -> list[tuple[str, object, str]]:
    """(name, client, model) for every provider with credentials, in order."""
    from openai import OpenAI  # imported here so dry runs need no package

    out = []
    if os.getenv("OPENAI_API_KEY"):
        out.append(("openai", OpenAI(api_key=os.environ["OPENAI_API_KEY"], max_retries=3, timeout=600), MODEL))
    url, key, model = (os.getenv(k) for k in ("GHOST_FALLBACK_BASE_URL", "GHOST_FALLBACK_API_KEY",
                                                "GHOST_FALLBACK_MODEL"))
    if url and key and model:
        out.append(("fallback", OpenAI(base_url=url, api_key=key, max_retries=3, timeout=600), model))
    return out


def openai_client():
    """The OpenAI client alone, for images, which the fallback is not asked for."""
    if not os.getenv("OPENAI_API_KEY"):
        return None
    from openai import OpenAI
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"], max_retries=1)


def chat_json(system: str, user: str, temperature: float) -> dict:
    """One JSON-object chat completion from the first provider that answers."""
    reasons = []
    found = providers()
    if not found:
        raise NoModel("no provider configured: set OPENAI_API_KEY or the GHOST_FALLBACK_* settings")
    for name, client, model in found:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system},
                          {"role": "user", "content": user}],
                temperature=temperature,
                response_format={"type": "json_object"},
            )
            text = response.choices[0].message.content or ""
            # Some compatible endpoints ignore response_format and fence the JSON.
            text = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text)
            data = json.loads(text)
            if not isinstance(data, dict):
                raise ValueError("the answer was JSON but not an object")
            if name != found[0][0]:
                print(f"answered by {name} ({model}) after: {'; '.join(reasons)}")
            return data
        except Exception as exc:  # noqa: BLE001 - any refusal means try the next provider
            reasons.append(f"{name} ({model}): {str(exc)[:300]}")
    raise NoModel("; ".join(reasons))


def warn(message: str) -> None:
    """A warning that shows on the Actions run page as well as in the log."""
    print(message)
    if os.getenv("GITHUB_ACTIONS"):
        print("::warning::" + message.replace("\n", " ")[:900])
    summary = os.getenv("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(message + "\n\n")
