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
import requests # Added for image downloading

try:
    from openai import OpenAI  # type: ignore
except ImportError as exc:  # pragma: no cover - handled at runtime
    raise SystemExit(
        "The 'openai' package is required. Install it with 'pip install openai'."
    ) from exc


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_ROOT = Path(__file__).resolve().parent
_PROMPT_BASE_CANDIDATES = [
    REPO_ROOT / "assets",
    SCRIPT_ROOT / "assets",
]


def _resolve_prompt_root() -> Path:
    for base in _PROMPT_BASE_CANDIDATES:
        if (base / "prompts").exists():
            return base
    return _PROMPT_BASE_CANDIDATES[-1]


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_ROOT = Path(__file__).resolve().parent
_PROMPT_BASE_CANDIDATES = [
    REPO_ROOT / "assets",
    SCRIPT_ROOT / "assets",
]


def _resolve_prompt_root() -> Path:
    for base in _PROMPT_BASE_CANDIDATES:
        if (base / "prompts").exists():
            return base
    return _PROMPT_BASE_CANDIDATES[-1]


PROMPT_ROOT = _resolve_prompt_root()
OUTPUT_ROOT = REPO_ROOT / "assets" / "daily_mission"
SYSTEM_PROMPT_PATH = PROMPT_ROOT / "prompts" / "daily_mission_system.txt"
TASK_PROMPT_PATH = PROMPT_ROOT / "prompts" / "daily_mission_task.txt"
DEFAULT_OUTPUT_PATH = OUTPUT_ROOT / "daily_mission.json"
IMAGE_DIR = OUTPUT_ROOT
IMAGE_WEB_PATH = "/assets/daily_mission"

def download_image(image_url: str, local_path: Path) -> None:
    print(f"Downloading image from {image_url} to {local_path}")
    try:
        response = requests.get(image_url, stream=True)
        response.raise_for_status()  # Raise an exception for bad status codes
        local_path.parent.mkdir(parents=True, exist_ok=True)
        with open(local_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Image successfully downloaded to {local_path}")
    except requests.exceptions.RequestException as e:
        print(f"Error downloading image from {image_url}: {e}", file=sys.stderr)
        raise
REQUIRED_TOP_LEVEL_KEYS = [
    "title",
    "description",
    "difficulty",
    "estimated_playtime_minutes",
    "region", # New field for image generation
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
TRAIT_REQUIRED_KEYS = [
    "gender",
    "hair_color",
    "hobby",
    "vehicle",
    "favorite_food",
]

def generate_dalle_image(
    client: OpenAI,
    prompt_text: str,
    size: str,
    quality: str = "standard",
    style: str = "vivid",
) -> str:
    print(f"Generating DALL-E image with prompt: {prompt_text[:100]}... (size: {size})")
    try:
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt_text,
            size=size,
            quality=quality,
            style=style,
            n=1,
        )
        image_url = response.data[0].url
        print(f"Generated image URL: {image_url}")
        return image_url
    except Exception as e:
        print(f"Error generating DALL-E image: {e}", file=sys.stderr)
        raise


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
    # To ensure a new mission is generated each time the workflow is run (even on the same day),
    # we incorporate the current timestamp into the seed.
    # If a specific date is provided, it's still part of the seed, but the timestamp ensures uniqueness per run.
    current_timestamp = datetime.now(timezone.utc).isoformat()
    payload = f"agency_atlas_daily::{date_iso}::{current_timestamp}"
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

    # No longer strictly enforcing 'extreme' difficulty as per user feedback.
    # if str(mission.get("difficulty", "")).lower() != "extreme":
    #     raise SystemExit("Daily mission difficulty must be 'extreme'.")

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
    for key in TRAIT_REQUIRED_KEYS:
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
    print("Starting generate_daily_mission.py script...")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY environment variable is required.")
    print("OPENAI_API_KEY found.")

    config = parse_args()
    print(f"Parsed arguments: date_iso={config.date_iso}, output_path={config.output_path}, model={config.model}, max_tokens={config.max_tokens}, temperature={config.temperature}")

    seed_hex = compute_seed(config.date_iso)
    print(f"Computed seed: {seed_hex}")

    system_prompt = load_prompt(SYSTEM_PROMPT_PATH)
    print(f"Loaded system prompt from {SYSTEM_PROMPT_PATH}")
    task_prompt = build_task_prompt(seed_hex, config.date_iso)
    print(f"Built task prompt: {task_prompt[:200]}...") # Print first 200 chars

    client = OpenAI(api_key=api_key)
    print("OpenAI client initialized.")

    print("Requesting mission from OpenAI API...")
    payload = request_mission(
        client,
        system_prompt=system_prompt,
        task_prompt=task_prompt,
        model=config.model,
        max_tokens=config.max_tokens,
        temperature=config.temperature,
    )
    print("Received response from OpenAI API.")
    print(f"Raw OpenAI payload: {payload[:500]}...") # Print first 500 chars of raw payload

    mission = parse_json_payload(payload)
    print("JSON payload parsed successfully.")

    print("Validating mission structure...")
    validate_mission(mission)
    print("Mission structure validated.")

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    mission_id = f"daily_{config.date_iso.replace('-', '')}"
    print(f"Generated mission_id: {mission_id}, generated_at: {generated_at}")

    mission = augment_mission(
        mission,
        mission_id=mission_id,
        seed_hex=seed_hex,
        generated_at_iso=generated_at,
    )
    print("Mission augmented with ID and timestamp.")

    # Write initial mission JSON (without image URLs) to ensure it's always generated
    write_output(mission, config.output_path)
    print(f"Initial daily mission JSON written to {config.output_path}")

    # Extract details for image generation
    mission_title = mission.get("title", "Unknown Mission")
    mission_region = mission.get("region", "Unknown Region")
    mission_synopsis = mission.get("description", "A mysterious mission.")

    # Define Thumbnail Image Prompt
    thumbnail_prompt_text = (
        f"Create a retro 16-bit pixel art style image for a geography investigation game mission.\n\n"
        f"Mission: {mission_title}\n"
        f"Region: {mission_region}\n"
        f"Synopsis: {mission_synopsis}\n\n"
        f"Style requirements:\n"
        f"- Classic 16-bit pixel art aesthetic (like SNES/Sega Genesis era)\n"
        f"- Vibrant, colorful palette with clean pixels\n"
        f"- Show an iconic landmark or scene from {mission_region}\n"
        f"- Include a subtle sense of mystery or investigation\n"
        f"- Agency Atlas detective game visual style\n"
        f"- Landscape orientation\n"
        f"- Render only the environment/landmark — absolutely no characters, signage, UI overlays, letters, numbers, logos, or text-like marks anywhere in the art\n"
        f"- No text or words in the image under any circumstance\n"
        f"- IMPORTANT: Absolutely no text, words, letters, numbers, or symbols of any kind in the image.\n"
        f"- Family-friendly and educational tone\n\n"
        f"Focus on making it look like authentic retro game art from the 1990s."
    )

    # Define Banner Image Prompt
    banner_prompt_text = (
        f"Create a wide, retro 16-bit pixel art banner for a geography investigation game.\n\n"
        f"Mission: {mission_title}\n"
        f"Region: {mission_region}\n\n"
        f"Style requirements:\n"
        f"- Classic 16-bit pixel art (SNES/Genesis era)\n"
        f"- Wide panoramic view of {mission_region}\n"
        f"- Vibrant retro game colors\n"
        f"- Atmospheric and mysterious mood\n"
        f"- Agency Atlas detective game aesthetic\n"
        f"- Render only the scenery — absolutely no characters, signage, UI overlays, letters, numbers, logos, or any text-like marks\n"
        f"- No text or words in the image under any circumstance\n"
        f"- IMPORTANT: Absolutely no text, words, letters, numbers, or symbols of any kind in the image.\n"
        f"- 1792x1024 landscape orientation\n"
        f"- No text or words in the image\n"
        f"- Iconic landmarks or scenery from {mission_region}\n\n"
        f"Make it feel like a classic 90s adventure game title screen."
    )

    try:
        # Generate Thumbnail Image
        thumbnail_dalle_url = generate_dalle_image(client, thumbnail_prompt_text, "1024x1024")
        thumbnail_filename = f"thumbnail_{config.date_iso.replace('-', '')}.png"
        thumbnail_local_path = IMAGE_DIR / thumbnail_filename
        download_image(thumbnail_dalle_url, thumbnail_local_path)
        mission["thumbnail_image_url"] = f"{IMAGE_WEB_PATH}/{thumbnail_filename}"

        # Generate Banner Image
        banner_dalle_url = generate_dalle_image(client, banner_prompt_text, "1792x1024")
        banner_filename = f"banner_{config.date_iso.replace('-', '')}.png"
        banner_local_path = IMAGE_DIR / banner_filename
        download_image(banner_dalle_url, banner_local_path)
        mission["banner_image_url"] = f"{IMAGE_WEB_PATH}/{banner_filename}"

        # Re-write mission JSON with image URLs
        write_output(mission, config.output_path)
        print(f"Daily mission JSON updated with image URLs and re-written to {config.output_path}")

    except Exception as e:
        print(f"Warning: Image generation or download failed: {e}", file=sys.stderr)
        print(f"Daily mission JSON remains at {config.output_path} without image URLs.", file=sys.stderr)

    print("Script finished.")


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(exc.code if isinstance(exc.code, int) else 1) # Ensure proper exit code
    except Exception as exc:
        print(f"An unexpected error occurred: {exc}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)