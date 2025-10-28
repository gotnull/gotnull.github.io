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
    """Download an image from a URL to a local path."""
    print(f"Downloading image from {image_url} to {local_path}")
    try:
        response = requests.get(image_url, stream=True, timeout=30)
        response.raise_for_status()
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
    "region",
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
CITY_REQUIRED_KEYS = ["city_name", "country", "order_in_chase", "locations"]
LOCATION_REQUIRED_KEYS = ["name", "npc_dialogue", "clue_type", "clue_value", "point_value"]
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
    """Generate a DALL-E image and return its URL."""
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
    """Configuration for mission generation."""
    date_iso: str
    output_path: Path
    model: str
    max_tokens: int
    temperature: float


def parse_args() -> GenerationConfig:
    """Parse command-line arguments."""
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
    """Normalize a date string to YYYY-MM-DD format."""
    if raw_date:
        try:
            parsed = datetime.strptime(raw_date, "%Y-%m-%d")
        except ValueError as exc:
            raise SystemExit(
                f"Invalid date '{raw_date}'. Expected YYYY-MM-DD format."
            ) from exc
        return parsed.strftime("%Y-%m-%d")
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def compute_seed(date_iso: str) -> str:
    """Compute a deterministic seed from the date and current timestamp."""
    # To ensure a new mission is generated each time the workflow is run (even on the same day),
    # we incorporate the current timestamp into the seed.
    current_timestamp = datetime.now(timezone.utc).isoformat()
    payload = f"agency_atlas_daily::{date_iso}::{current_timestamp}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def load_prompt(path: Path) -> str:
    """Load a prompt file from disk."""
    if not path.exists():
        raise SystemExit(f"Prompt file missing: {path}")
    return path.read_text(encoding="utf-8").strip()


def build_task_prompt(
    seed_hex: str, date_iso: str, previous_mission: Dict[str, Any] | None
) -> str:
    """Build the task prompt with seed, date, and previous mission context."""
    task_template = load_prompt(TASK_PROMPT_PATH)
    previous_mission_str = ""
    if previous_mission:
        # Extract key elements from previous mission for comparison
        prev_title = previous_mission.get("title", "N/A")
        prev_region = previous_mission.get("region", "N/A")
        prev_difficulty = previous_mission.get("difficulty", "N/A")
        prev_solution_snippet = previous_mission.get("solution", "N/A")[
            :100
        ]  # Snippet to avoid hitting token limits

        previous_mission_str = (
            f"\n\nPREVIOUS MISSION DETAILS (for uniqueness comparison):\n"
            f"Title: {prev_title}\n"
            f"Region: {prev_region}\n"
            f"Difficulty: {prev_difficulty}\n"
            f"Solution Snippet: {prev_solution_snippet}...\n"
            f"---\n"
        )

    return (
        task_template.replace("{seed}", seed_hex)
        .replace("{dateIso}", date_iso)
        .replace("{previousMissionDetails}", previous_mission_str)
    )


def request_mission(
    client: OpenAI,
    *,
    system_prompt: str,
    task_prompt: str,
    model: str,
    max_tokens: int,
    temperature: float,
) -> str:
    """Request a mission from the OpenAI API."""
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
    """Parse a JSON payload from string."""
    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        raise SystemExit(
            f"OpenAI response was not valid JSON: {exc}\nPayload:\n{payload}"
        ) from exc


def validate_mission(mission: Dict[str, Any]) -> None:
    """Validate the generated mission structure and content."""
    # Check required top-level keys
    missing = [key for key in REQUIRED_TOP_LEVEL_KEYS if key not in mission]
    if missing:
        raise SystemExit(f"Generated mission missing keys: {', '.join(missing)}")

    # Validate region field
    region = mission.get("region")
    if not isinstance(region, str) or not region.strip():
        raise SystemExit("region field must be a non-empty string.")

    # Validate solution field
    solution = mission.get("solution")
    if not isinstance(solution, str) or not solution.strip():
        raise SystemExit("solution field must be a non-empty string.")

    # Validate cities structure
    cities = mission.get("cities")
    if not isinstance(cities, list) or not (3 <= len(cities) <= 5):
        raise SystemExit("Mission must contain 3-5 cities.")

    # Validate order_in_chase: must be 1-indexed, sequential, and unique
    order_values = []
    city_names_in_chase = []

    for city in cities:
        if not isinstance(city, dict):
            raise SystemExit("City entries must be JSON objects.")

        # Check required city keys
        for key in CITY_REQUIRED_KEYS:
            if key not in city:
                raise SystemExit(f"City entry missing '{key}'.")

        order = city.get("order_in_chase")
        if not isinstance(order, int):
            raise SystemExit(
                f"City '{city.get('city_name', 'unknown')}' has invalid order_in_chase (must be integer)."
            )
        order_values.append(order)

        city_name = city.get("city_name")
        if city_name:
            city_names_in_chase.append(city_name)

    # Check order_in_chase is 1-indexed and sequential
    order_values_sorted = sorted(order_values)
    expected = list(range(1, len(cities) + 1))
    if order_values_sorted != expected:
        raise SystemExit(
            f"order_in_chase values must be 1-indexed and sequential (1, 2, 3, ...). "
            f"Got: {order_values_sorted}, expected: {expected}"
        )

    # Check for duplicate order_in_chase values
    if len(order_values) != len(set(order_values)):
        raise SystemExit(f"Duplicate order_in_chase values found: {order_values}")

    # Validate final_city format
    final_city = mission.get("final_city")
    if not isinstance(final_city, str) or "," not in final_city:
        raise SystemExit('final_city must be formatted as "CityName, CountryName".')

    # Validate final_city does NOT appear in any city in the cities array
    final_city_name = final_city.split(",")[0].strip()
    final_city_country = (
        final_city.split(",")[1].strip() if len(final_city.split(",")) > 1 else ""
    )

    # Check both city name alone and full "City, Country" format
    if final_city_name in city_names_in_chase:
        raise SystemExit(
            f"CRITICAL: final_city ('{final_city_name}') MUST NOT appear in the cities array. "
            f"Cities in chase: {city_names_in_chase}"
        )

    # Also check if any city has matching name AND country (belt and suspenders)
    for city in cities:
        if isinstance(city, dict):
            if (
                city.get("city_name") == final_city_name
                and city.get("country") == final_city_country
            ):
                raise SystemExit(
                    f"CRITICAL: final_city ('{final_city}') matches city in chase: "
                    f"{city.get('city_name')}, {city.get('country')}"
                )

    # Validate arrest_location
    arrest_location = mission.get("arrest_location")
    if not isinstance(arrest_location, str) or not arrest_location.strip():
        raise SystemExit("arrest_location must be a non-empty string.")

    # Validate locations within each city
    for city in cities:
        locations = city.get("locations")
        if not isinstance(locations, list) or len(locations) != 3:
            raise SystemExit(
                f"City '{city.get('city_name')}' must contain exactly three locations."
            )
        for location in locations:
            if not isinstance(location, dict):
                raise SystemExit("Location entries must be JSON objects.")
            for key in LOCATION_REQUIRED_KEYS:
                value = location.get(key)
                if key == "point_value":
                    # Validate point_value is an integer between 45-120
                    if not isinstance(value, int) or not (45 <= value <= 120):
                        raise SystemExit(
                            f"Location '{location.get('name')}' point_value must be integer between 45-120. Got: {value}"
                        )
                else:
                    if not isinstance(value, str) or not value.strip():
                        raise SystemExit(
                            f"Location '{location.get('name', 'unknown')}' missing non-empty '{key}'."
                        )

    # Validate suspects
    suspects = mission.get("suspect_database")
    if not isinstance(suspects, list) or not (4 <= len(suspects) <= 6):
        raise SystemExit("suspect_database must contain 4-6 suspects.")

    for suspect in suspects:
        if not isinstance(suspect, dict):
            raise SystemExit("Suspect entries must be JSON objects.")
        for key in SUSPECT_REQUIRED_KEYS:
            if key not in suspect:
                raise SystemExit(f"Suspect '{suspect.get('name', 'unknown')}' missing '{key}'.")

    # Validate correct_suspect
    correct_suspect_name = mission.get("correct_suspect")
    if not isinstance(correct_suspect_name, str) or not correct_suspect_name.strip():
        raise SystemExit("correct_suspect name is missing or empty.")

    # Validate correct_suspect matches one name in suspect_database
    found_correct_suspect = None
    for suspect in suspects:
        if isinstance(suspect, dict) and suspect.get("name") == correct_suspect_name:
            found_correct_suspect = suspect
            break
    if not found_correct_suspect:
        raise SystemExit(
            f"correct_suspect ('{correct_suspect_name}') does not match any name in suspect_database."
        )

    # Validate suspect_traits
    traits = mission.get("suspect_traits")
    if not isinstance(traits, dict):
        raise SystemExit("suspect_traits must be an object.")

    # Validate suspect_traits matches the correct suspect's traits exactly
    for key in TRAIT_REQUIRED_KEYS:
        trait_value_from_mission = traits.get(key)
        trait_value_from_suspect = found_correct_suspect.get(key)
        if not isinstance(trait_value_from_mission, str) or not trait_value_from_mission.strip():
            raise SystemExit(f"suspect_traits missing non-empty '{key}'.")
        if trait_value_from_mission != trait_value_from_suspect:
            raise SystemExit(
                f"suspect_traits '{key}' ('{trait_value_from_mission}') does not match "
                f"correct suspect's trait ('{trait_value_from_suspect}')."
            )

    # Validate rewards
    rewards = mission.get("rewards")
    if not isinstance(rewards, dict):
        raise SystemExit("rewards must be an object.")
    if "experience_points" not in rewards or "credits_earned" not in rewards:
        raise SystemExit("rewards must include experience_points and credits_earned.")

    # Validate internal_analyzer
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
    """Augment mission with ID, seed, and timestamp."""
    mission.setdefault("mission_id", mission_id)
    mission.setdefault("id", mission_id)
    mission["seed"] = seed_hex
    mission["generated_at_utc"] = generated_at_iso
    return mission


def write_output(mission: Dict[str, Any], output_path: Path) -> None:
    """Write mission JSON to disk."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(mission, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def read_previous_mission(path: Path) -> Dict[str, Any] | None:
    """Read the previous mission JSON if it exists."""
    if path.exists():
        try:
            content = path.read_text(encoding="utf-8")
            return json.loads(content)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(
                f"Warning: Could not read or parse previous mission from {path}: {e}",
                file=sys.stderr,
            )
            return None
    return None


def main() -> None:
    """Main entry point for the script."""
    print("Starting generate_daily_mission.py script...")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY environment variable is required.")
    print("OPENAI_API_KEY found.")

    config = parse_args()
    print(
        f"Parsed arguments: date_iso={config.date_iso}, output_path={config.output_path}, "
        f"model={config.model}, max_tokens={config.max_tokens}, temperature={config.temperature}"
    )

    previous_mission = read_previous_mission(config.output_path)
    if previous_mission:
        print("Previous mission found and loaded.")
    else:
        print("No previous mission found or could not be loaded.")

    seed_hex = compute_seed(config.date_iso)
    print(f"Computed seed: {seed_hex}")

    system_prompt = load_prompt(SYSTEM_PROMPT_PATH)
    print(f"Loaded system prompt from {SYSTEM_PROMPT_PATH}")
    task_prompt = build_task_prompt(seed_hex, config.date_iso, previous_mission)
    print(f"Built task prompt: {task_prompt[:200]}...")  # Print first 200 chars

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
    print(f"Raw OpenAI payload: {payload[:500]}...")  # Print first 500 chars of raw payload

    mission = parse_json_payload(payload)
    print("JSON payload parsed successfully.")

    print("Validating mission structure...")
    validate_mission(mission)
    print("Mission structure validated successfully! ✅")

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

    # Define Thumbnail Image Prompt
    thumbnail_prompt_text = f"""You are a famous pixel artist specializing in retro 16-bit game art. You have been asked to create an original image that appeals to an adult based on the following criteria:

Main Theme: A retro 16-bit pixel art scene depicting a key landmark or atmospheric location from {mission_region}, related to the mission '{mission_title}'.
It should be colorful, realistic (within pixel art style), minimalistic, and somewhat of a challenge to replicate.
It should only contain the "Main Theme" (the scene) and no other elements in the foreground, background or surrounding space that are not part of the scene itself.
It should not divide the "Main Theme" into separate parts of the image nor imply any variations of it.
It should not contain any text, labels, borders, measurements nor design elements of any kind.
The image should be suitable for digital printing without any instructional or guiding elements.
The "Main Theme" (the scene) should consume the entire 1024x1024 space, with no margins.
Style requirements:
- Classic 16-bit pixel art aesthetic (like SNES/Sega Genesis era)
- Vibrant, colorful palette with clean pixels
- Include a subtle sense of mystery or investigation
- Agency Atlas detective game visual style
- Landscape orientation
- Family-friendly and educational tone

Focus on making it look like authentic retro game art from the 1990s."""

    # Define Banner Image Prompt
    banner_prompt_text = (
        f"You are a famous pixel artist specializing in retro 16-bit game art. You have been asked to create an original image that appeals to an adult based on the following criteria:\n\n"
        f"Main Theme: A wide, retro 16-bit pixel art panoramic view of {mission_region}, related to the mission '{mission_title}'.\n"
        f"It should be colorful, realistic (within pixel art style), minimalistic, and somewhat of a challenge to replicate.\n"
        f"It should only contain the \"Main Theme\" (the panoramic scene) and no other elements in the foreground, background or surrounding space that are not part of the scene itself.\n"
        f"It should not divide the \"Main Theme\" into separate parts of the image nor imply any variations of it.\n"
        f"It should not contain any text, labels, borders, measurements nor design elements of any kind.\n"
        f"The image should be suitable for digital printing without any instructional or guiding elements.\n"
        f"The \"Main Theme\" (the panoramic scene) should consume the entire 1792x1024 space, with no margins.\n"
        f"Style requirements:\n"
        f"- Classic 16-bit pixel art (SNES/Genesis era)\n"
        f"- Vibrant retro game colors\n"
        f"- Atmospheric and mysterious mood\n"
        f"- Agency Atlas detective game aesthetic\n"
        f"- Render only the scenery — absolutely no characters, signage, UI overlays, letters, numbers, logos, or any text-like marks\n"
        f"- 1792x1024 landscape orientation\n\n"
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
        print(
            f"Daily mission JSON updated with image URLs and re-written to {config.output_path}"
        )

    except Exception as e:
        print(f"Warning: Image generation or download failed: {e}", file=sys.stderr)
        print(
            f"Daily mission JSON remains at {config.output_path} without image URLs.",
            file=sys.stderr,
        )

    print("✅ Script finished successfully!")


if __name__ == "__main__":
    try:
        main()
    except SystemExit as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(exc.code if isinstance(exc.code, int) else 1)
    except Exception as exc:
        print(f"An unexpected error occurred: {exc}", file=sys.stderr)
        import traceback

        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
