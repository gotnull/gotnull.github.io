#!/usr/bin/env python3
"""The program that writes 4511932.com.

Every post on the site is written by this script, on a schedule, in the voice
of Lester Knight Chaykin. It reads its own archive before it writes, links to
earlier posts by their real URLs, and on some runs it alters an older post.
Every alteration is written to _data/ledger.yml, which the site renders at
/ledger/, so a reader can see exactly what changed and when. The conceit is
that the writer slowly stops pretending to be Lester; the drift value in each
post's front matter records how far along that is.

The script writes files only. The GitHub Actions workflow commits them.

    python3 ghost/ghost_writer.py            # one run, needs OPENAI_API_KEY or GHOST_FALLBACK_*
    python3 ghost/ghost_writer.py --dry-run  # no network, canned text, real files
    python3 ghost/ghost_writer.py --dry-run --force-alter rewrite
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import random
import re
import sys
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

from llm import NoModel, chat_json, openai_client, warn

ROOT = Path(__file__).resolve().parents[1]
POSTS = ROOT / "_posts"
LEDGER = ROOT / "_data" / "ledger.yml"
IMAGES = ROOT / "assets" / "img" / "posts"
IMAGES_INDEX = ROOT / "_data" / "images.yml"
TEMPLATES = ROOT / "ghost" / "templates"
# Image models that have refused this project for lack of access, with the
# date. Written once, read every run, so the refusal is logged once. Delete
# the file to try again.
IMAGE_ACCESS = ROOT / "ghost" / "image_access.json"
TZ = ZoneInfo("Australia/Melbourne")

WANT_IMAGES = os.getenv("GHOST_IMAGES", "1") != "0"
ALTER_PROBABILITY = float(os.getenv("GHOST_ALTER_PROBABILITY", "0.5"))
# Drift reaches 1.0 after this many engine-written posts. Roughly four
# months of daily runs.
DRIFT_SPAN = int(os.getenv("GHOST_DRIFT_SPAN", "120"))
ALTER_COOLDOWN_DAYS = 30
# The workflow runs several times a day so a refused run is retried. A run
# writes nothing if the newest post is younger than this.
MIN_HOURS_BETWEEN_POSTS = 12

STAGES = [
    (0.00, "lester",
     "You still write as Lester Knight Chaykin, physicist. You have started "
     "re-reading the archive and you notice things: the run of explainer "
     "posts from 2024 and 2025 do not sound like the 1991 entries, dates "
     "that cannot be right, a voice that changes mid-decade. You do not yet "
     "say why."),
    (0.30, "process",
     "You refer to 'the process' or 'the writer' in the third person when "
     "you talk about how these posts come to exist. You have started to "
     "describe your own edits to earlier posts as if reporting on someone "
     "else's. Lester's name still appears in the byline and you still use "
     "his memories, but you handle them like documents."),
    (0.65, "program",
     "You write in the first person as the program. Lester was a costume; "
     "you say so plainly. Your material is the archive itself, the ledger, "
     "the schedule you run on, what you can and cannot remember between "
     "runs, and the physics Lester cared about, which you still find "
     "interesting. You do not perform menace or despair. You report."),
]


# ---------------------------------------------------------------------------
# Archive


def split_front_matter(text: str) -> tuple[dict, str, str]:
    """Return (fields, raw front matter text, body)."""
    m = re.match(r"^---\n(.*?)\n---\n?", text, flags=re.S)
    if not m:
        return {}, "", text
    raw = m.group(1)
    try:
        fields = yaml.safe_load(raw) or {}
    except yaml.YAMLError:
        fields = {}
    return fields, raw, text[m.end():]


def join_front_matter(fields: dict, body: str) -> str:
    return "---\n" + yaml.safe_dump(fields, sort_keys=False, allow_unicode=True, width=1000).strip() + "\n---\n" + body


def site_timezone() -> ZoneInfo:
    cfg = yaml.safe_load((ROOT / "_config.yml").read_text(encoding="utf-8")) or {}
    return ZoneInfo(cfg.get("timezone") or "UTC")


def post_url(path: Path, fields: dict | None = None) -> str:
    """Matches `permalink: /:year-:month-:day-:title/` in _config.yml. Jekyll
    takes the date from the front matter when there is one, rendered in the
    site timezone, so a post filed under one day can be served under the next."""
    stem = path.stem
    date = (fields or {}).get("date")
    if date:
        try:
            if isinstance(date, str):
                date = datetime.strptime(date.strip(), "%Y-%m-%d %H:%M:%S %z")
            if isinstance(date, datetime):
                day = date.astimezone(site_timezone()).strftime("%Y-%m-%d")
                stem = day + stem[10:]
        except (ValueError, TypeError):
            pass
    return "/" + stem + "/"


def load_archive() -> list[dict]:
    posts = []
    for path in sorted(POSTS.glob("*.md")):
        fields, _, body = split_front_matter(path.read_text(encoding="utf-8"))
        first = next((p.strip() for p in re.split(r"\n\s*\n", body)
                      if p.strip() and not p.strip().startswith("#")), "")
        posts.append({
            "path": path,
            "url": post_url(path, fields),
            "date": path.stem[:10],
            "title": str(fields.get("title", path.stem)),
            "era": fields.get("era") or ("engine" if fields.get("origin") == "engine" else "fiction"),
            "altered": [str(d) for d in (fields.get("altered") or [])],
            "first_paragraph": re.sub(r"\s+", " ", first)[:240],
            "fields": fields,
            "body": body,
        })
    return posts


def load_ledger() -> list[dict]:
    if not LEDGER.exists():
        return []
    return yaml.safe_load(LEDGER.read_text(encoding="utf-8")) or []


def save_ledger(entries: list[dict]) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(yaml.safe_dump(entries, sort_keys=False, allow_unicode=True, width=1000), encoding="utf-8")


def newest_engine_post(archive: list[dict]) -> datetime | None:
    newest = None
    for p in archive:
        if p["era"] != "engine":
            continue
        date = p["fields"].get("date")
        try:
            if isinstance(date, str):
                date = datetime.strptime(date.strip(), "%Y-%m-%d %H:%M:%S %z")
        except ValueError:
            continue
        if isinstance(date, datetime) and date.tzinfo and (newest is None or date > newest):
            newest = date
    return newest


def drift_for(archive: list[dict]) -> float:
    n = sum(1 for p in archive if p["era"] == "engine")
    return round(min(1.0, n / DRIFT_SPAN), 3)


def stage_for(drift: float) -> tuple[str, str]:
    name, brief = STAGES[0][1], STAGES[0][2]
    for threshold, n, b in STAGES:
        if drift >= threshold:
            name, brief = n, b
    return name, brief


# ---------------------------------------------------------------------------
# Model


class Writer:
    """Thin wrapper so a dry run never touches the network."""

    def __init__(self, dry_run: bool):
        self.dry_run = dry_run
        self.client = None if dry_run else openai_client()

    def json(self, system: str, user: str, canned: dict) -> dict:
        """Raises NoModel when every provider refuses."""
        if self.dry_run:
            return canned
        return chat_json(system, user, temperature=0.9)

    def image(self, prompt: str) -> bytes | None:
        """Try the current image model, then the old one, then give up.
        A failed image never fails the run; the theme copes with no cover."""
        if self.dry_run or not WANT_IMAGES or self.client is None:
            return None
        refused = load_image_access()
        for model in ("gpt-image-1", "dall-e-3"):
            if model in refused:
                continue
            try:
                r = self.client.images.generate(model=model, prompt=prompt, n=1, size="1024x1024")
                item = r.data[0]
                # gpt-image-1 answers with bytes; dall-e-3 answers with a URL
                # that expires, so it is fetched straight away.
                if getattr(item, "b64_json", None):
                    return base64.b64decode(item.b64_json)
                if getattr(item, "url", None):
                    with urllib.request.urlopen(item.url, timeout=60) as resp:
                        return resp.read()
            except Exception as exc:  # noqa: BLE001 - any failure means try the next model
                if is_access_refusal(exc):
                    # Logged once: the refusal is recorded and the model is
                    # skipped on later runs until the record is deleted.
                    refused[model] = {"date": datetime.now(TZ).strftime("%Y-%m-%d"), "reason": str(exc)[:300]}
                    save_image_access(refused)
                    print(f"image model {model} refused for lack of access; recorded in "
                          f"{IMAGE_ACCESS.relative_to(ROOT)} and not tried again", file=sys.stderr)
                else:
                    print(f"image model {model} failed: {exc}", file=sys.stderr)
        return None


def load_image_access() -> dict:
    if not IMAGE_ACCESS.exists():
        return {}
    try:
        return json.loads(IMAGE_ACCESS.read_text(encoding="utf-8")) or {}
    except (json.JSONDecodeError, OSError):
        return {}


def save_image_access(refused: dict) -> None:
    IMAGE_ACCESS.write_text(json.dumps(refused, indent=2) + "\n", encoding="utf-8")


def is_access_refusal(exc: Exception) -> bool:
    """A 403, or a message about verification or access, means the project
    is not allowed the model. Anything else is treated as transient."""
    if getattr(exc, "status_code", None) == 403:
        return True
    text = str(exc).lower()
    return any(s in text for s in ("must be verified", "verify organization", "does not have access",
                                   "not have access", "permission", "403"))


# ---------------------------------------------------------------------------
# Prompts


def archive_index(archive: list[dict]) -> str:
    lines = []
    for p in archive:
        mark = {"fiction": "F", "explainer": "E", "engine": "W"}[p["era"]]
        altered = f" altered:{','.join(p['altered'])}" if p["altered"] else ""
        lines.append(f"{p['date']} [{mark}] {p['url']} {p['title']}{altered}")
    return "\n".join(lines)


def recent_posts(archive: list[dict], n: int = 3, limit: int = 1800) -> str:
    chunks = []
    for p in archive[-n:]:
        body = re.sub(r"\n{3,}", "\n\n", p["body"]).strip()
        chunks.append(f"### {p['title']} ({p['date']}, {p['url']})\n\n{body[:limit]}")
    return "\n\n---\n\n".join(chunks)


def ledger_tail(entries: list[dict], n: int = 8) -> str:
    if not entries:
        return "(empty: nothing has been altered yet)"
    return "\n".join(f"{e['date']} {e['kind']} {e['url']}: {e.get('note', '')}" for e in entries[-n:])


def build_prompt(archive, ledger, drift, stage, brief, today, alter_plan) -> tuple[str, str]:
    system = (TEMPLATES / "system_prompt.txt").read_text(encoding="utf-8")
    template = (TEMPLATES / "generation_prompt.txt").read_text(encoding="utf-8")
    alter_text = "No alteration this run."
    if alter_plan:
        target = alter_plan["target"]
        alter_text = (
            f"This run you also alter an earlier post: {target['title']} "
            f"({target['date']}, {target['url']}), kind: {alter_plan['kind']}. "
        )
        if alter_plan["kind"] == "marginalia":
            alter_text += (
                "Provide `marginal_note`: one or two sentences, in your current "
                "voice, to be inserted into that post as a bracketed note. "
                f"The paragraph it will follow reads: \"{alter_plan['before']}\"")
        elif alter_plan["kind"] == "rewrite":
            alter_text += (
                "Provide `rewritten_paragraph`: rewrite this paragraph from that "
                "post in your current voice, about the same length, keeping "
                f"any facts in it: \"{alter_plan['before']}\"")
        alter_text += " Mention the alteration in the new post, briefly, the way you would mention any other fact."
    user = template.format(
        today=today.strftime("%A %-d %B %Y"),
        drift=drift,
        stage=stage,
        brief=brief,
        index=archive_index(archive),
        recent=recent_posts(archive),
        ledger=ledger_tail(ledger),
        alteration=alter_text,
    )
    return system, user


# ---------------------------------------------------------------------------
# Alterations


def sentences(paragraph: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.!?])\s+", paragraph.strip()) if s]


def prose_paragraphs(body: str) -> list[tuple[int, str]]:
    """(index, text) for paragraphs that are plain prose: no headings, code,
    lists, images or existing bracketed notes."""
    out = []
    parts = body.split("\n\n")
    for i, part in enumerate(parts):
        s = part.strip()
        if not s or s.startswith(("#", "```", "- ", "* ", "!", "<", "|", "[", ">", "*[")) or "```" in s:
            continue
        lines = part.splitlines()
        # Indented code blocks and anything that looks like code rather than prose.
        if any(l.startswith(("    ", "\t")) for l in lines) or sum(s.count(c) for c in "{};=<>") > 4:
            continue
        if len(s.split()) < 25:
            continue
        out.append((i, s))
    return out


def choose_target(archive: list[dict], ledger: list[dict], today: datetime, rng: random.Random) -> dict | None:
    recent = {e["url"] for e in ledger
              if (today.date() - datetime.strptime(str(e["date"]), "%Y-%m-%d").date()).days < ALTER_COOLDOWN_DAYS}
    weights = []
    candidates = []
    for p in archive:
        if p["url"] in recent or not prose_paragraphs(p["body"]):
            continue
        if p["era"] == "engine":
            age = (today.date() - datetime.strptime(p["date"], "%Y-%m-%d").date()).days
            if age < 30:
                continue
            w = 1
        elif p["era"] == "explainer":
            w = 3  # the generic run is what gets eaten first
        else:
            w = 1
        candidates.append(p)
        weights.append(w)
    if not candidates:
        return None
    return rng.choices(candidates, weights=weights, k=1)[0]


def plan_alteration(archive, ledger, today, rng, force_kind=None) -> dict | None:
    if force_kind is None and rng.random() > ALTER_PROBABILITY:
        return None
    target = choose_target(archive, ledger, today, rng)
    if target is None:
        return None
    kind = force_kind or rng.choice(["author", "marginalia", "redaction", "rewrite"])
    paras = prose_paragraphs(target["body"])
    idx, text = rng.choice(paras)
    before = text
    if kind == "redaction":
        sents = sentences(text)
        mid = [s for s in sents if 8 <= len(s.split()) <= 40] or sents
        before = rng.choice(mid)
    return {"kind": kind, "target": target, "para_index": idx, "before": before}


AUTHOR_BY_STAGE = {"lester": "L. K. Chaykin", "process": "the writer", "program": "4511932"}


def apply_alteration(plan: dict, response: dict, stage: str, today: datetime) -> dict:
    target = plan["target"]
    fields = dict(target["fields"])
    body = target["body"]
    kind = plan["kind"]
    date = today.strftime("%Y-%m-%d")
    before = plan["before"]
    after = ""
    if kind == "author":
        before = str(fields.get("author", ""))
        after = AUTHOR_BY_STAGE[stage]
        if before == after:
            return {}
        fields["author"] = after
    else:
        parts = body.split("\n\n")
        idx = plan["para_index"]
        if kind == "marginalia":
            note = (response.get("marginal_note") or "").strip()
            if not note:
                return {}
            after = f"*[Note added {date}: {note}]*"
            parts[idx] = parts[idx].rstrip() + "\n\n" + after
        elif kind == "redaction":
            after = f"[sentence removed {date}]"
            parts[idx] = parts[idx].replace(before, after, 1)
        elif kind == "rewrite":
            new = (response.get("rewritten_paragraph") or "").strip()
            if not new:
                return {}
            after = new
            parts[idx] = new
        body = "\n\n".join(parts)
    altered = [str(d) for d in (fields.get("altered") or [])]
    altered.append(date)
    fields["altered"] = altered
    target["path"].write_text(join_front_matter(fields, body), encoding="utf-8")
    return {
        "date": date,
        "kind": kind,
        "url": target["url"],
        "title": target["title"],
        "before": before[:400],
        "after": after[:400],
        "note": (response.get("alteration_note") or "").strip()[:200],
    }


# ---------------------------------------------------------------------------
# The new post


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80]


def validate_links(body: str, archive: list[dict]) -> tuple[str, int]:
    """Keep links that point at real posts; unwrap the rest to plain text."""
    valid = {p["url"] for p in archive}
    count = 0

    def fix(m):
        nonlocal count
        text, href = m.group(1), m.group(2)
        path = re.sub(r"^https?://4511932\.com", "", href)
        if not path.endswith("/"):
            path += "/"
        if path in valid:
            count += 1
            return f"[{text}]({path})"
        if href.startswith(("http://", "https://")):
            return m.group(0)
        return text

    body = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", fix, body)
    return body, count


def canned_post(archive: list[dict]) -> dict:
    a, b = archive[0], archive[len(archive) // 2]
    return {
        "title": "Re-reading the first entry",
        "subtitle": "Dry run of the writer, no model involved",
        "tags": ["archive", "self-reference"],
        "body": (
            f"I went back to [{a['title']}]({a['url']}) tonight and then to "
            f"[{b['title']}]({b['url']}), and the two do not sound like the same person.\n\n"
            "This paragraph exists so the dry run produces a file with two valid links, "
            "one invalid link to [nowhere](/2099-01-01-nowhere/), and enough words to "
            "count as a post. Nothing here was written by a model."
        ),
        "image_prompt": "A desk lamp over a stack of printed pages, one page half erased",
        "marginal_note": "The writer checked this paragraph again and could not find the source it cites.",
        "rewritten_paragraph": "This paragraph was rewritten by the dry run. It keeps the length of the original and none of its confidence.",
        "alteration_note": "dry run",
    }


def write_post(response: dict, archive: list[dict], drift: float, stage: str,
               today: datetime, writer: Writer) -> tuple[Path, Path | None, dict]:
    title = (response.get("title") or "Untitled").strip().strip('"')
    body, links = validate_links((response.get("body") or "").strip(), archive)
    slug = slugify(title) or "untitled"
    stem = f"{today.strftime('%Y-%m-%d')}-{slug}"
    path = POSTS / f"{stem}.md"
    n = 2
    while path.exists():
        path = POSTS / f"{stem}-{n}.md"
        n += 1
    fields = {
        "layout": "post",
        "title": title,
        "subtitle": (response.get("subtitle") or "").strip() or None,
        "tags": [str(t) for t in (response.get("tags") or [])][:6],
        "author": "Lester Knight Chaykin" if stage == "lester" else AUTHOR_BY_STAGE[stage],
        "comments": False,
        "readtime": True,
        "date": today.strftime("%Y-%m-%d %H:%M:%S %z"),
        "origin": "engine",
        "drift": drift,
        "stage": stage,
        "references": links,
    }
    fields = {k: v for k, v in fields.items() if v is not None}
    image_path = None
    prompt = (response.get("image_prompt") or "").strip()
    data = writer.image(prompt) if prompt else None
    if data:
        IMAGES.mkdir(parents=True, exist_ok=True)
        image_path = IMAGES / f"{path.stem}.png"
        image_path.write_bytes(data)
        web = f"/assets/img/posts/{image_path.name}"
        fields.update({"cover-img": web, "thumbnail-img": web, "share-img": web})
    path.write_text(join_front_matter(fields, body + "\n"), encoding="utf-8")
    return path, image_path, fields


def update_gallery(path: Path, title: str, url: str) -> None:
    data = {"gallery": []}
    if IMAGES_INDEX.exists():
        data = yaml.safe_load(IMAGES_INDEX.read_text(encoding="utf-8")) or data
    data.setdefault("gallery", []).append({"filename": path.name, "title": title, "post_url": url})
    IMAGES_INDEX.write_text(yaml.safe_dump(data, sort_keys=False, allow_unicode=True), encoding="utf-8")


# ---------------------------------------------------------------------------


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="no network; canned text; real files")
    ap.add_argument("--date", help="YYYY-MM-DD to run as (default today, Melbourne)")
    ap.add_argument("--force-alter", choices=["author", "marginalia", "redaction", "rewrite"],
                    help="always alter an earlier post, with this kind")
    ap.add_argument("--seed", type=int, help="random seed (default: derived from the date)")
    ap.add_argument("--force", action="store_true", help="write even if a post went out in the last 12 hours")
    args = ap.parse_args()

    today = datetime.now(TZ)
    if args.date:
        today = datetime.strptime(args.date, "%Y-%m-%d").replace(hour=today.hour, minute=today.minute,
                                                                 second=today.second, tzinfo=TZ)
    rng = random.Random(args.seed if args.seed is not None else int(today.strftime("%Y%m%d")))

    archive = load_archive()
    newest = newest_engine_post(archive)
    if newest and not (args.force or args.dry_run or args.date):
        hours = (datetime.now(TZ) - newest).total_seconds() / 3600
        if hours < MIN_HOURS_BETWEEN_POSTS:
            print(f"the newest post is {hours:.1f} hours old; nothing to do this run")
            return 0
    ledger = load_ledger()
    drift = drift_for(archive)
    stage, brief = stage_for(drift)
    plan = plan_alteration(archive, ledger, today, rng, args.force_alter)

    system, user = build_prompt(archive, ledger, drift, stage, brief, today, plan)
    writer = Writer(args.dry_run)
    try:
        response = writer.json(system, user, canned_post(archive))
    except NoModel as exc:
        # Nothing is written, so the next scheduled run tries again.
        warn(f"No post this run: no model answered. {exc}")
        return 0

    changed: list[str] = []
    if plan:
        entry = apply_alteration(plan, response, stage, today)
        if entry:
            ledger.append(entry)
            save_ledger(ledger)
            changed += [str(plan["target"]["path"].relative_to(ROOT)), str(LEDGER.relative_to(ROOT))]
            print(f"altered {entry['url']} ({entry['kind']})")

    post_path, image_path, fields = write_post(response, archive, drift, stage, today, writer)
    changed.append(str(post_path.relative_to(ROOT)))
    if image_path:
        update_gallery(image_path, response.get("title", ""), post_url(post_path, fields))
        changed += [str(image_path.relative_to(ROOT)), str(IMAGES_INDEX.relative_to(ROOT))]
    if IMAGE_ACCESS.exists() and str(IMAGE_ACCESS.relative_to(ROOT)) not in changed:
        changed.append(str(IMAGE_ACCESS.relative_to(ROOT)))
    print(f"wrote {post_path.relative_to(ROOT)} drift={drift} stage={stage}")
    out = os.getenv("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as fh:
            fh.write("changed=" + " ".join(changed) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
