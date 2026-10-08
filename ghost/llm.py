"""The model the programs talk to, with a second provider behind the first.

OpenAI is tried first. If it refuses (out of credit, key revoked, an outage
that outlasts the client's own retries), the same request goes to GitHub
Models, which an Actions run can call with its own GITHUB_TOKEN and which
needs no secret or billing of its own. A run only gives up when every
provider has refused, and then it says why instead of raising.

    from llm import chat_json, NoModel
    try:
        data = chat_json(system, user, temperature=0.9)
    except NoModel as exc:
        ...  # str(exc) lists each provider and what it said
"""
from __future__ import annotations

import json
import os

MODEL = os.getenv("GHOST_MODEL", "gpt-4o")
GITHUB_MODELS_URL = "https://models.github.ai/inference"


class NoModel(Exception):
    """Every provider refused. The message lists each one and its reason."""


def providers() -> list[tuple[str, object, str]]:
    """(name, client, model) for every provider with credentials, in order."""
    from openai import OpenAI  # imported here so dry runs need no package

    out = []
    if os.getenv("OPENAI_API_KEY"):
        out.append(("openai", OpenAI(api_key=os.environ["OPENAI_API_KEY"], max_retries=3, timeout=600), MODEL))
    if os.getenv("GITHUB_TOKEN"):
        model = os.getenv("GHOST_FALLBACK_MODEL") or (MODEL if "/" in MODEL else "openai/" + MODEL)
        out.append(("github-models", OpenAI(base_url=GITHUB_MODELS_URL, api_key=os.environ["GITHUB_TOKEN"],
                                            max_retries=3, timeout=600), model))
    return out


def openai_client():
    """The OpenAI client alone, for calls GitHub Models cannot serve (images)."""
    if not os.getenv("OPENAI_API_KEY"):
        return None
    from openai import OpenAI
    return OpenAI(api_key=os.environ["OPENAI_API_KEY"], max_retries=1)


def chat_json(system: str, user: str, temperature: float) -> dict:
    """One JSON-object chat completion from the first provider that answers."""
    reasons = []
    found = providers()
    if not found:
        raise NoModel("no provider configured: set OPENAI_API_KEY or GITHUB_TOKEN")
    for name, client, model in found:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system},
                          {"role": "user", "content": user}],
                temperature=temperature,
                response_format={"type": "json_object"},
            )
            data = json.loads(response.choices[0].message.content)
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
