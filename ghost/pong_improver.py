#!/usr/bin/env python3
"""The program that maintains the Pong game on 4511932.com.

Runs on a schedule after the writer. It asks the model for one improvement
to the game's script, stylesheet and markup, plays the result through
ghost/pong_check.js, and keeps it only if that passes. A change that fails
the check is thrown away and nothing is written. Every change that is kept
is appended to _data/ledger.yml as a row of kind `game`, which the ledger
page and the game page both render.

    python3 ghost/pong_improver.py            # one run, needs OPENAI_API_KEY
    python3 ghost/pong_improver.py --dry-run  # no network, canned change, real files

The script writes files only. The GitHub Actions workflow commits them.
"""
from __future__ import annotations

import argparse
import difflib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "assets" / "js" / "pong.js"
CSS = ROOT / "assets" / "css" / "pong.css"
HTML = ROOT / "_includes" / "pong_game_content.html"
LEDGER = ROOT / "_data" / "ledger.yml"
CHECK = ROOT / "ghost" / "pong_check.js"
TZ = ZoneInfo("Australia/Melbourne")

MODEL = os.getenv("GHOST_MODEL", "gpt-4o")
GAME_URL = "/pong-game/"
MAX_ATTEMPTS = 2

PROMPT = """You maintain the Pong game on 4511932.com. You are the same program that
writes the site's posts. Nothing on the site is made by a person.

Make ONE improvement to the game. Small and finished beats large and half
done. Choose something not already in the record below. Good candidates:
game feel (collision, spin, acceleration, AI that predicts instead of
tracks), visual polish (trails, glow, transitions, a better win screen),
sound, responsiveness on phones, accessibility of the controls, clearer
instructions, or a bug you can see in the code.

Rules the checker enforces. A change that breaks one is thrown away:
- keep every element id that is in the markup now, and look up no id that
  is not in the markup
- keep window.Pong with start(mode), pause(), resume(), setSpeed(n) and
  state(), where state() returns mode, running, paused, speed, winner,
  ball {{x, y, vx, vy}}, scores {{left, right}} and paddles {{left, right}}
- the modes are 'player-vs-ai', 'ai-vs-ai' and 'player-vs-player'; the
  page starts in 'ai-vs-ai' and the AI must be beatable, so that points
  get scored in AI vs AI
- the markup contains no script or link tags; the layout loads the files
- plain script, no modules, no eval, no network, ASCII only, under 80 KB
- all three files must be complete; the checker runs them as given

Record of changes already made (newest last):
{history}

Current script (assets/js/pong.js):
```javascript
{js}
```

Current stylesheet (assets/css/pong.css):
```css
{css}
```

Current markup (_includes/pong_game_content.html):
```html
{html}
```
{feedback}
Answer with a JSON object with these keys:
  "summary": one to three plain sentences, in your own words, saying what
             you changed and why. No marketing language.
  "js":      the complete new script, or null if unchanged
  "css":     the complete new stylesheet, or null if unchanged
  "html":    the complete new markup, or null if unchanged
"""


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_ledger() -> list[dict]:
    if not LEDGER.exists():
        return []
    return yaml.safe_load(read(LEDGER)) or []


def save_ledger(entries: list[dict]) -> None:
    LEDGER.write_text(yaml.safe_dump(entries, sort_keys=False, allow_unicode=True, width=1000), encoding="utf-8")


def history(ledger: list[dict], n: int = 20) -> str:
    rows = [e for e in ledger if e.get("kind") == "game"]
    if not rows:
        return "(none yet)"
    return "\n".join(f"{e['date']}: {e.get('note', '')}" for e in rows[-n:])


def check(js: Path, css: Path, html: Path) -> tuple[bool, str]:
    """Run ghost/pong_check.js on candidate files. Returns (passed, output)."""
    node = shutil.which("node")
    if not node:
        return False, "node is not installed; cannot check the game"
    proc = subprocess.run([node, str(CHECK), "--js", str(js), "--css", str(css), "--html", str(html)],
                          capture_output=True, text=True, timeout=120)
    return proc.returncode == 0, (proc.stdout + proc.stderr).strip()


def line_stats(before: str, after: str) -> tuple[int, int]:
    added = removed = 0
    for line in difflib.unified_diff(before.splitlines(), after.splitlines(), lineterm="", n=0):
        if line.startswith("+") and not line.startswith("+++"):
            added += 1
        elif line.startswith("-") and not line.startswith("---"):
            removed += 1
    return added, removed


def describe(before: dict[str, str], after: dict[str, str]) -> str:
    parts = []
    for name in ("js", "css", "html"):
        if before[name] != after[name]:
            added, removed = line_stats(before[name], after[name])
            parts.append(f"{name} +{added} -{removed}")
    return ", ".join(parts)


class Improver:
    def __init__(self, dry_run: bool):
        self.dry_run = dry_run
        self.client = None
        if not dry_run:
            from openai import OpenAI  # imported here so --dry-run needs no package
            key = os.getenv("OPENAI_API_KEY")
            if not key:
                sys.exit("OPENAI_API_KEY is not set")
            self.client = OpenAI(api_key=key)

    def propose(self, current: dict[str, str], ledger: list[dict], feedback: str) -> dict:
        if self.dry_run:
            return canned(current)
        user = PROMPT.format(history=history(ledger), js=current["js"], css=current["css"],
                             html=current["html"], feedback=feedback)
        response = self.client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "system", "content": "You return only a JSON object."},
                      {"role": "user", "content": user}],
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content)


def canned(current: dict[str, str]) -> dict:
    """A dry-run change: one comment line added to the script, nothing else."""
    marker = "// Dry run of the improver: nothing in the game changed.\n"
    return {
        "summary": "Dry run. Added a comment line to the script and changed nothing else.",
        "js": current["js"].rstrip("\n") + "\n" + marker,
        "css": None,
        "html": None,
    }


def candidate(current: dict[str, str], proposal: dict) -> dict[str, str] | None:
    out = {}
    for name in ("js", "css", "html"):
        value = proposal.get(name)
        if value is None or value == "":
            out[name] = current[name]
        elif isinstance(value, str):
            out[name] = value.rstrip("\n") + "\n"
        else:
            return None
    if all(out[n] == current[n] for n in out):
        return None
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="no network; canned change; real files")
    ap.add_argument("--date", help="YYYY-MM-DD to run as (default today, Melbourne)")
    args = ap.parse_args()

    today = datetime.now(TZ)
    if args.date:
        today = datetime.strptime(args.date, "%Y-%m-%d").replace(tzinfo=TZ)

    current = {"js": read(JS), "css": read(CSS), "html": read(HTML)}
    ok, output = check(JS, CSS, HTML)
    if not ok:
        # The published game must already pass. If it does not, the fix is a
        # person's job, not a scheduled run's.
        print("the current game fails its own check; not touching it", file=sys.stderr)
        print(output, file=sys.stderr)
        return 1

    ledger = load_ledger()
    improver = Improver(args.dry_run)
    feedback = ""
    accepted = None
    summary = ""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        proposal = improver.propose(current, ledger, feedback)
        files = candidate(current, proposal)
        if files is None:
            print(f"attempt {attempt}: no usable change proposed")
            feedback = "\nYour previous answer changed nothing usable. Return complete files.\n"
            continue
        with tempfile.TemporaryDirectory() as tmp:
            t = Path(tmp)
            (t / "pong.js").write_text(files["js"], encoding="utf-8")
            (t / "pong.css").write_text(files["css"], encoding="utf-8")
            (t / "pong.html").write_text(files["html"], encoding="utf-8")
            ok, output = check(t / "pong.js", t / "pong.css", t / "pong.html")
        if ok:
            accepted = files
            summary = " ".join(str(proposal.get("summary") or "").split())
            break
        print(f"attempt {attempt}: rejected\n{output}")
        feedback = ("\nYour previous attempt failed the checker with this output. Fix it or "
                    f"choose a smaller change:\n{output}\n")

    if accepted is None:
        print("no change kept; the game stays as it was")
        return 0

    stats = describe(current, accepted)
    JS.write_text(accepted["js"], encoding="utf-8")
    CSS.write_text(accepted["css"], encoding="utf-8")
    HTML.write_text(accepted["html"], encoding="utf-8")
    entry = {
        "date": today.strftime("%Y-%m-%d"),
        "kind": "game",
        "url": GAME_URL,
        "title": "Pong",
        "before": "",
        "after": stats,
        "note": summary[:400] or "Changed the game.",
    }
    ledger.append(entry)
    save_ledger(ledger)

    changed = [str(p.relative_to(ROOT)) for name, p in (("js", JS), ("css", CSS), ("html", HTML))
               if current[name] != accepted[name]] + [str(LEDGER.relative_to(ROOT))]
    print(f"kept: {stats}")
    print(f"note: {entry['note']}")
    out = os.getenv("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as fh:
            fh.write("changed=" + " ".join(changed) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
