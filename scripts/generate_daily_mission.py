#!/usr/bin/env python3
"""Generate the Agency Atlas daily mission JSON via the OpenAI API."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

try:
    from openai import OpenAI  # type: ignore
except ImportError as exc:  # pragma: no cover - handled at runtime
    raise SystemExit(
        "The 'openai' package is required. Install it with 'pip install openai'."
    ) from exc


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_ROOT = Path(__file__).resolve().parent
_ASSET_BASE_CANDIDATES = [
    REPO_ROOT / "assets",
    SCRIPT_ROOT / "assets",
]


def _resolve_assets_root() -> Path:
    for base in _ASSET_BASE_CANDIDATES:
        if (base / "prompts").exists():
            return base
    return _ASSET_BASE_CANDIDATES[-1]


ASSETS_ROOT = _resolve_assets_root()
SYSTEM_PROMPT_PATH = ASSETS_ROOT / "prompts" / "daily_mission_system.txt"
TASK_PROMPT_PATH = ASSETS_ROOT / "prompts" / "daily_mission_task.txt"
DEFAULT_OUTPUT_PATH = ASSETS_ROOT / "daily_mission.json"
REQUIRED_TOP_LEVEL_KEYS = [
    "title",
    "description",
    "difficulty",
    "estimated_playtime_minutes",
    "cities",
    "suspect_database",
    "suspect_traits",
    "final_city",
    "arrest_location",
    "correct_suspect",
    "rewards",
    "internal_analyzer",
    "solution",
]
CITY_REQUIRED_KEYS = ["city_name", "country", "locations"]
LOCATION_REQUIRED_KEYS = ["name", "npc_dialogue", "clue_type", "clue_value"]
SUSPECT_REQUIRED_KEYS = [
    "name",
    "gender",
    "hair_color",
    "hobby",
    "vehicle",
    "favorite_food",
]


@dataclass(frozen=True)
class GenerationConfig:
    date_iso: str
    output_path: Path
    model: str
    max_tokens: int
    temperature: float


def parse_args() -> GenerationConfig:
    parser = argparse.ArgumentParser(
        description="Generate the Agency Atlas daily mission JSON.",
    )
    parser.add_argument(
        "--date",
        dest="date_iso",
        help="UTC date (YYYY-MM-DD). Defaults to today.",
    )
    parser.add_argument(
        "--output",
        dest="output_path",
        default=str(DEFAULT_OUTPUT_PATH),
        help="Destination path for the generated mission JSON.",
    )
    parser.add_argument(
        "--model",
        default="gpt-4o-mini",
        help="OpenAI model identifier.",
    )
    parser.add_argument(
        "--max-tokens",
        dest="max_tokens",
        type=int,
        default=2300,
        help="Maximum tokens returned by the completion.",
    )
    parser.add_argument(
        "--temperature",
        type=float,
        default=0.0,
        help="Sampling temperature for the completion.",
    )

    args = parser.parse_args()

    date_iso = normalise_date(args.date_iso)
    output_path = Path(args.output_path).resolve()
    return GenerationConfig(
        date_iso=date_iso,
        output_path=output_path,
        model=args.model,
        max_tokens=args.max_tokens,
        temperature=args.temperature,
    )


def normalise_date(raw_date: str | None) -> str:
    if raw_date:
        try:
            parsed = datetime.strptime(raw_date, "%Y-%m-%d")
        except ValueError as exc:
            raise SystemExit(f"Invalid date '{raw_date}'. Expected YYYY-MM-DD format.") from exc
        return parsed.strftime("%Y-%m-%d")
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def compute_seed(date_iso: str) -> str:
    payload = f"agency_atlas_daily::{date_iso}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def load_prompt(path: Path) -> str:
    if not path.exists():
        raise SystemExit(f"Prompt file missing: {path}")
    return path.read_text(encoding="utf-8").strip()


def build_task_prompt(seed_hex: str, date_iso: str) -> str:
    task_template = load_prompt(TASK_PROMPT_PATH)
    return task_template.replace("{seed}", seed_hex).replace("{dateIso}", date_iso)


def request_mission(
    client: OpenAI,
    *,
    system_prompt: str,
    task_prompt: str,
    model: str,
    max_tokens: int,
    temperature: float,
) -> str:
    response = client.chat.completions.create(
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": task_prompt},
        ],
    )
    try:
        content = response.choices[0].message.content
    except (IndexError, AttributeError) as exc:
        raise SystemExit("OpenAI response was missing completion content.") from exc
    if not content:
        raise SystemExit("OpenAI response contained empty content.")
    return content.strip()


def parse_json_payload(payload: str) -> Dict[str, Any]:
    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise SystemExit(
            f"OpenAI response was not valid JSON: {exc}\nPayload:\n{payload}"
        ) from exc


def validate_mission(mission: Dict[str, Any]) -> None:
    missing = [key for key in REQUIRED_TOP_LEVEL_KEYS if key not in mission]
    if missing:
        raise SystemExit(f"Generated mission missing keys: {', '.join(missing)}")

    if str(mission.get("difficulty", "")).lower() != "extreme":
        raise SystemExit("Daily mission difficulty must be 'extreme'.")

    cities = mission.get("cities")
    if not isinstance(cities, list) or not (3 <= len(cities) <= 5):
        raise SystemExit("Mission must contain 3-5 cities.")
    for city in cities:
        if not isinstance(city, dict):
            raise SystemExit("City entries must be JSON objects.")
        for key in CITY_REQUIRED_KEYS:
            if key not in city:
                raise SystemExit(f"City entry missing '{key}'.")
        locations = city.get("locations")
        if not isinstance(locations, list) or len(locations) != 3:
            raise SystemExit("Each city must contain exactly three locations.")
        for location in locations:
            if not isinstance(location, dict):
                raise SystemExit("Location entries must be JSON objects.")
            for key in LOCATION_REQUIRED_KEYS:
                value = location.get(key)
                if not isinstance(value, str) or not value.strip():
                    raise SystemExit(f"Location missing non-empty '{key}'.")

    suspects = mission.get("suspect_database")
    if not isinstance(suspects, list) or not (4 <= len(suspects) <= 6):
        raise SystemExit("suspect_database must contain 4-6 suspects.")
    for suspect in suspects:
        if not isinstance(suspect, dict):
            raise SystemExit("Suspect entries must be JSON objects.")
        for key in SUSPECT_REQUIRED_KEYS:
            value = suspect.get(key)
            if not isinstance(value, str) or not value.strip():
                raise SystemExit(f"Suspect missing non-empty '{key}'.")

    traits = mission.get("suspect_traits")
    if not isinstance(traits, dict):
        raise SystemExit("suspect_traits must be an object.")
    for key in SUSPECT_REQUIRED_KEYS:
        value = traits.get(key)
        if not isinstance(value, str) or not value.strip():
            raise SystemExit(f"suspect_traits missing non-empty '{key}'.")

    rewards = mission.get("rewards")
    if not isinstance(rewards, dict):
        raise SystemExit("rewards must be an object.")
    if "experience_points" not in rewards or "credits_earned" not in rewards:
        raise SystemExit("rewards must include experience_points and credits_earned.")

    analyzer = mission.get("internal_analyzer")
    if not isinstance(analyzer, dict):
        raise SystemExit("internal_analyzer must be an object.")


def augment_mission(
    mission: Dict[str, Any],
    *,
    mission_id: str,
    seed_hex: str,
    generated_at_iso: str,
) -> Dict[str, Any]:
    mission.setdefault("mission_id", mission_id)
    mission.setdefault("id", mission_id)
    mission["seed"] = seed_hex
    mission["generated_at_utc"] = generated_at_iso
    return mission


def write_output(mission: Dict[str, Any], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(mission, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY environment variable is required.")

    config = parse_args()
    seed_hex = compute_seed(config.date_iso)
    system_prompt = load_prompt(SYSTEM_PROMPT_PATH)
    task_prompt = build_task_prompt(seed_hex, config.date_iso)

    client = OpenAI(api_key=api_key)
    payload = request_mission(
        client,
        system_prompt=system_prompt,
        task_prompt=task_prompt,
        model=config.model,
        max_tokens=config.max_tokens,
        temperature=config.temperature,
    )

    mission = parse_json_payload(payload)
    validate_mission(mission)

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    mission_id = f"daily_{config.date_iso.replace('-', '')}"
    mission = augment_mission(
        mission,
        mission_id=mission_id,
        seed_hex=seed_hex,
        generated_at_iso=generated_at,
    )

    write_output(mission, config.output_path)
    print(f"Daily mission written to {config.output_path}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        print(str(exc), file=sys.stderr)
        raise