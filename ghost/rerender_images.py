#!/usr/bin/env python3
"""Re-render the cover images with a current image model.

Every cover image in assets/img/posts/ was made by DALL-E 3 or earlier. This
script makes each one again with a current model, writing over the same
file name so no post, gallery entry or URL changes. For each image it reads
the post it belongs to, asks the text model for a photographic prompt, and
renders it.

    python3 ghost/rerender_images.py --dry-run          # list what would be made
    python3 ghost/rerender_images.py --limit 5          # the first five not yet done
    python3 ghost/rerender_images.py --only hello.jpg   # one file

Progress is recorded in ghost/rerender_manifest.json so a run can stop and
be resumed. Delete an entry, or pass --force, to make an image again.
Needs OPENAI_API_KEY. The image model is GHOST_IMAGE_MODEL; the default,
auto, lists the models the project may use and takes the newest gpt-image
version among them. The prompt model is GHOST_MODEL (default gpt-4o).
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ghost_writer as gw  # noqa: E402  the archive loader and front matter helpers

ROOT = gw.ROOT
IMAGES = ROOT / "assets" / "img" / "posts"
MANIFEST = ROOT / "ghost" / "rerender_manifest.json"
TZ = ZoneInfo("Australia/Melbourne")

TEXT_MODEL = os.getenv("GHOST_MODEL", "gpt-4o")
IMAGE_MODEL = os.getenv("GHOST_IMAGE_MODEL", "auto")
IMAGE_SIZE = os.getenv("GHOST_IMAGE_SIZE", "1536x1024")
IMAGE_QUALITY = os.getenv("GHOST_IMAGE_QUALITY", "high")
REFUSAL_RETRIES = int(os.getenv("GHOST_REFUSAL_RETRIES", "6"))
REFUSAL_WAIT = int(os.getenv("GHOST_REFUSAL_WAIT", "45"))

STYLE = (
    "A single photorealistic image, shot on a full-frame camera with a 35mm or "
    "50mm lens, natural or practical light, shallow depth of field, true-to-life "
    "colour, film-like grain, no text, no captions, no logos, no watermarks, no "
    "diagrams, no floating icons, no collage. It should look like a photograph a "
    "person took, not an illustration."
)

PROMPT = """You write prompts for a photorealistic image model. Describe ONE scene
to illustrate the post below as a photograph: a concrete place, objects and
light, at most 90 words, present tense, no lists. Never ask for text,
labels, diagrams or logos in the image. Prefer a real workbench, lab, desk,
landscape or street over abstractions.

Era: {era}
Title: {title}
Subtitle: {subtitle}
Tags: {tags}
Opening: {opening}

Answer with a JSON object: {{"prompt": "..."}}
"""

ERA_HINTS = {
    "fiction": "Lester Knight Chaykin's story: a physicist, a particle accelerator in an underground lab, lightning, an alien world. Cinematic, 1990s equipment, real places.",
    "explainer": "A technical explainer about hardware or programming. Show the real hardware on a real bench: boards, wires, oscilloscopes, screens, hands.",
    "engine": "The program writing about its own archive. Quiet, documentary, a desk or an archive, paper and screens, late light.",
}


def load_manifest() -> dict:
    if MANIFEST.exists():
        try:
            return json.loads(MANIFEST.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {}


def save_manifest(m: dict) -> None:
    MANIFEST.write_text(json.dumps(m, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def images_in_use() -> list[dict]:
    """Every image file referenced by a post or listed in the gallery."""
    seen: dict[str, dict] = {}
    for p in gw.load_archive():
        for key in ("cover-img", "thumbnail-img", "share-img"):
            ref = p["fields"].get(key)
            if not ref:
                continue
            name = Path(str(ref)).name
            if name not in seen:
                seen[name] = {"file": name, "post": p}
    gallery_path = ROOT / "_data" / "images.yml"
    if gallery_path.exists():
        data = yaml.safe_load(gallery_path.read_text(encoding="utf-8")) or {}
        by_url = {p["url"]: p for p in gw.load_archive()}
        for item in data.get("gallery", []):
            name = str(item.get("filename", ""))
            if name and name not in seen:
                seen[name] = {"file": name, "post": by_url.get(item.get("post_url")), "title": item.get("title")}
    out = [v for v in seen.values() if (IMAGES / v["file"]).exists()]
    return sorted(out, key=lambda v: v["file"])


def opening(post: dict | None) -> str:
    if not post:
        return ""
    return post["first_paragraph"]


def make_prompt(client, item: dict) -> str:
    post = item.get("post")
    era = post["era"] if post else "fiction"
    user = PROMPT.format(
        era=ERA_HINTS.get(era, ERA_HINTS["fiction"]),
        title=post["title"] if post else item.get("title") or item["file"],
        subtitle=(post["fields"].get("subtitle") if post else "") or "",
        tags=", ".join(str(t) for t in (post["fields"].get("tags") or [])) if post else "",
        opening=opening(post),
    )
    r = client.chat.completions.create(
        model=TEXT_MODEL,
        messages=[{"role": "system", "content": "You return only a JSON object."},
                  {"role": "user", "content": user}],
        temperature=0.8,
        response_format={"type": "json_object"},
    )
    prompt = (json.loads(r.choices[0].message.content).get("prompt") or "").strip()
    if not prompt:
        raise RuntimeError("empty prompt from the text model")
    return prompt + " " + STYLE


# Variants of one version, best first, for when the project allows several.
VARIANT_ORDER = os.getenv("GHOST_IMAGE_VARIANTS", "sunburst,flare").split(",")


def version_key(model_id: str) -> tuple:
    """(version, variant rank) for ids like gpt-image-2.5-sunburst; empty for
    anything else, including mini and dated snapshots."""
    m = re.fullmatch(r"gpt-image-(\d+(?:\.\d+)?)(?:-([a-z]+))?", model_id)
    if not m or m.group(2) == "mini":
        return ()
    variant = m.group(2) or ""
    rank = -VARIANT_ORDER.index(variant) if variant in VARIANT_ORDER else -len(VARIANT_ORDER)
    return (float(m.group(1)), rank)


def pick_image_model(client) -> str:
    """The newest gpt-image model the project is allowed. Mini and dated
    snapshot variants are left out; dall-e is the fallback if there is none."""
    ids = [m.id for m in client.models.list().data]
    candidates = sorted((i for i in ids if version_key(i)), key=version_key)
    if candidates:
        return candidates[-1]
    if "dall-e-3" in ids:
        return "dall-e-3"
    raise RuntimeError("no image model is available to this project; allow a gpt-image model in the OpenAI dashboard")


def render(client, prompt: str, suffix: str) -> bytes:
    fmt = "jpeg" if suffix.lower() in (".jpg", ".jpeg") else "png"
    kwargs = dict(model=IMAGE_MODEL, prompt=prompt, n=1, size=IMAGE_SIZE)
    if IMAGE_MODEL.startswith("gpt-image"):
        kwargs.update(quality=IMAGE_QUALITY, output_format=fmt)
        if fmt == "jpeg":
            kwargs["output_compression"] = 88
    r = client.images.generate(**kwargs)
    item = r.data[0]
    if getattr(item, "b64_json", None):
        return base64.b64decode(item.b64_json)
    if getattr(item, "url", None):
        import urllib.request
        with urllib.request.urlopen(item.url, timeout=120) as resp:
            return resp.read()
    raise RuntimeError("the image model returned neither bytes nor a URL")


def main() -> int:
    global IMAGE_MODEL
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="list the images and stop; no network")
    ap.add_argument("--limit", type=int, default=0, help="stop after this many images (0: all)")
    ap.add_argument("--only", action="append", default=[], help="only this file name (repeatable)")
    ap.add_argument("--force", action="store_true", help="make images again even if the manifest says done")
    args = ap.parse_args()

    items = images_in_use()
    if args.only:
        items = [i for i in items if i["file"] in set(args.only)]
    manifest = load_manifest()
    todo = [i for i in items if args.force or i["file"] not in manifest]
    print(f"{len(items)} images in use, {len(todo)} to make, model {IMAGE_MODEL} {IMAGE_SIZE} {IMAGE_QUALITY}")
    if args.dry_run:
        for i in todo:
            print(f"  {i['file']}  <- {i['post']['url'] if i.get('post') else '(gallery only)'}")
        return 0

    from openai import OpenAI
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        sys.exit("OPENAI_API_KEY is not set")
    client = OpenAI(api_key=key)
    if IMAGE_MODEL == "auto":
        IMAGE_MODEL = pick_image_model(client)
        print(f"using {IMAGE_MODEL}")

    made = 0
    changed = []
    for item in todo:
        if args.limit and made >= args.limit:
            break
        path = IMAGES / item["file"]
        data = None
        refused = 0
        for attempt in range(1, REFUSAL_RETRIES + 2):
            try:
                prompt = make_prompt(client, item)
                data = render(client, prompt, path.suffix)
                break
            except Exception as exc:  # noqa: BLE001  report; a failed image stays as it was
                msg = str(exc)
                print(f"FAIL {item['file']} (attempt {attempt}): {msg[:300]}", file=sys.stderr)
                if not gw.is_access_refusal(exc):
                    break
                # Access to a newly allowed model can flap for a while as the
                # change propagates; wait and try the same image again.
                refused += 1
                if attempt <= REFUSAL_RETRIES:
                    time.sleep(REFUSAL_WAIT)
        if data is None:
            if refused > REFUSAL_RETRIES:
                print(f"{IMAGE_MODEL} refused {refused} times in a row; stopping. Allow the model for this "
                      "project at platform.openai.com, or set GHOST_IMAGE_MODEL to one it may use.", file=sys.stderr)
                break
            continue
        path.write_bytes(data)
        manifest[item["file"]] = {
            "date": datetime.now(TZ).strftime("%Y-%m-%d"),
            "model": IMAGE_MODEL,
            "size": IMAGE_SIZE,
            "prompt": prompt,
        }
        save_manifest(manifest)
        changed.append(str(path.relative_to(ROOT)))
        made += 1
        print(f"made {item['file']} ({len(data) // 1024} KB)")

    if changed:
        changed.append(str(MANIFEST.relative_to(ROOT)))
    out = os.getenv("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as fh:
            fh.write("changed=" + " ".join(changed) + "\n")
    print(f"done: {made} made, {len(todo) - made} left")
    return 0


if __name__ == "__main__":
    sys.exit(main())
