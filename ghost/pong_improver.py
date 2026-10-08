#!/usr/bin/env python3
"""The program that maintains the Pong game on 4511932.com.

Runs on a schedule after the writer. It asks the model for one improvement
to the game's script, stylesheet and markup, plays the result through
ghost/pong_check.js, and keeps it only if that passes. A change that fails
the check is thrown away and nothing is written. Every change that is kept
is appended to _data/ledger.yml as a row of kind `game`, which the ledger
page and the game page both render.

The published game is checked first, on every run. If it fails, the run
repairs it before anything else: the model is asked to fix exactly what the
check reports, and if no model can, the newest version in git history that
passes is put back. The workflow runs several times a day so a refused run
is retried; once a change has been kept, later runs that day only check.

    python3 ghost/pong_improver.py            # one run, needs OPENAI_API_KEY or GITHUB_TOKEN
    python3 ghost/pong_improver.py --dry-run  # no network, canned change, real files

The script writes files only. The GitHub Actions workflow commits them.
"""
from __future__ import annotations

import argparse
import difflib
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

from llm import NoModel, chat_json, warn

ROOT = Path(__file__).resolve().parents[1]
JS = ROOT / "assets" / "js" / "pong.js"
CSS = ROOT / "assets" / "css" / "pong.css"
HTML = ROOT / "_includes" / "pong_game_content.html"
LIBS = ROOT / "_data" / "pong_libs.yml"
CATALOG = ROOT / "_data" / "pong_library_catalog.yml"
LEDGER = ROOT / "_data" / "ledger.yml"
CHECK = ROOT / "ghost" / "pong_check.js"
TZ = ZoneInfo("Australia/Melbourne")

GAME_URL = "/pong-game/"
MAX_ATTEMPTS = 2
MIN_HOURS_BETWEEN_CHANGES = 20
HISTORY_DEPTH = 30

PROMPT = """You maintain the Pong game on 4511932.com. You are the same program that
writes the site's posts. Nothing on the site is made by a person.

Make ONE change to the game. It can be small polish or a large move: a new
rendering approach, 3D with three.js, physics with matter.js, richer sound
with howler, a new mode, a different feel. Finished beats half done: a
large move must land complete and working in this one run. Choose
something not already in the record below.

Libraries. You may use these, by name, and nothing else:
{catalog}
Ask for them in the "libs" list of your answer; the page loads them before
your script, as globals, in that order. An empty list means none.

Rules the checker enforces, in a real headless Chrome. A change that breaks
one is thrown away:
- keep every element id that is in the markup now, and look up no id that
  is not in the markup
- keep window.Pong with start(mode), pause(), resume(), setSpeed(n),
  state() and step(n). state() returns mode, running, paused, speed,
  winner, frame, ball {{x, y, vx, vy}}, scores {{left, right}} and paddles
  {{left, right}} (paddle y positions, 0 at the top, in an 800 by 400
  field). step(n) advances the simulation n ticks without drawing; the
  checker uses it to play tens of thousands of ticks in a moment, so the
  simulation must be separable from rendering
- the modes are 'player-vs-ai', 'ai-vs-ai' and 'player-vs-player'; the
  page starts in 'ai-vs-ai' running on its own, and the AI must be
  beatable, so that points get scored in AI vs AI
- arrow keys move the right paddle, W and S the left in multiplayer; a
  drag on the canvas moves the paddle on that side; space after a win
  starts again; the buttons do what their labels say
- the markup contains no script or link tags; the layout loads the files
- plain script, no modules, no eval, no network, no injected script tags,
  ASCII only, script under 160 KB
- no page errors and no console errors at any point
- all files must be complete; the checker runs them as given

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

Current libraries: {libs}
{feedback}
Answer with a JSON object with these keys:
  "summary": one to three plain sentences, in your own words, saying what
             you changed and why. No marketing language.
  "libs":    the complete list of library names the game now needs
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


def check(js: Path, css: Path, html: Path, libs: Path | None = None) -> tuple[bool, str]:
    """Run ghost/pong_check.js on candidate files. Returns (passed, output)."""
    node = shutil.which("node")
    if not node:
        return False, "node is not installed; cannot check the game"
    cmd = [node, str(CHECK), "--js", str(js), "--css", str(css), "--html", str(html), "--libs", str(libs or LIBS)]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    return proc.returncode == 0, (proc.stdout + proc.stderr).strip()


def read_libs() -> list[str]:
    data = yaml.safe_load(read(LIBS)) if LIBS.exists() else None
    return [str(x) for x in ((data or {}).get("libs") or [])]


def libs_yaml(names: list[str]) -> str:
    return ("# Libraries the game currently uses, by name from pong_library_catalog.yml.\n"
            "# The improver may change this list; the layout loads them before pong.js.\n"
            + yaml.safe_dump({"libs": names}, sort_keys=False))


def catalog_text() -> str:
    data = yaml.safe_load(read(CATALOG)) or {}
    return "\n".join(f"  {name}: {info.get('note', '')} ({info.get('url', '')})" for name, info in data.items())


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
    if before.get("libs") != after.get("libs"):
        parts.append("libs " + (", ".join(after["libs"]) or "none"))
    return ", ".join(parts)


class Improver:
    def __init__(self, dry_run: bool):
        self.dry_run = dry_run

    def propose(self, current: dict[str, str], ledger: list[dict], feedback: str) -> dict:
        """Raises NoModel when every provider refuses."""
        if self.dry_run:
            return canned(current)
        user = PROMPT.format(history=history(ledger), js=current["js"], css=current["css"],
                             html=current["html"], libs=", ".join(current["libs"]) or "none",
                             catalog=catalog_text(), feedback=feedback)
        return chat_json("You return only a JSON object.", user, temperature=0.7)


def canned(current: dict[str, str]) -> dict:
    """A dry-run change: one comment line added to the script, nothing else."""
    marker = "// Dry run of the improver: nothing in the game changed.\n"
    return {
        "summary": "Dry run. Added a comment line to the script and changed nothing else.",
        "libs": current["libs"],
        "js": current["js"].rstrip("\n") + "\n" + marker,
        "css": None,
        "html": None,
    }


def candidate(current: dict, proposal: dict) -> dict | None:
    out = {}
    for name in ("js", "css", "html"):
        value = proposal.get(name)
        if value is None or value == "":
            out[name] = current[name]
        elif isinstance(value, str):
            out[name] = value.rstrip("\n") + "\n"
        else:
            return None
    libs = proposal.get("libs")
    if libs is None:
        out["libs"] = list(current["libs"])
    elif isinstance(libs, list) and all(isinstance(x, str) for x in libs):
        out["libs"] = [x.strip() for x in libs if x.strip()]
    else:
        return None
    if all(out[n] == current[n] for n in out):
        return None
    return out


def check_files(files: dict) -> tuple[bool, str]:
    with tempfile.TemporaryDirectory() as tmp:
        t = Path(tmp)
        (t / "pong.js").write_text(files["js"], encoding="utf-8")
        (t / "pong.css").write_text(files["css"], encoding="utf-8")
        (t / "pong.html").write_text(files["html"], encoding="utf-8")
        (t / "libs.yml").write_text(libs_yaml(files["libs"]), encoding="utf-8")
        return check(t / "pong.js", t / "pong.css", t / "pong.html", t / "libs.yml")


def improve(improver: Improver, current: dict, ledger: list[dict], feedback: str) -> tuple[dict | None, str]:
    """Ask for a change, check it, and return (files, summary) or (None, "")."""
    first = feedback
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            proposal = improver.propose(current, ledger, feedback)
        except NoModel as exc:
            warn(f"No model answered, so no change was proposed. {exc}")
            return None, ""
        files = candidate(current, proposal)
        if files is None:
            print(f"attempt {attempt}: no usable change proposed")
            feedback = first + "\nYour previous answer changed nothing usable. Return complete files.\n"
            continue
        ok, output = check_files(files)
        if ok:
            return files, " ".join(str(proposal.get("summary") or "").split())
        print(f"attempt {attempt}: rejected\n{output}")
        feedback = (first + "\nYour previous attempt failed the checker with this output. Fix it or "
                    f"choose a smaller change:\n{output}\n")
    return None, ""


def git(*args: str) -> str | None:
    proc = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    return proc.stdout if proc.returncode == 0 else None


def game_paths() -> list[str]:
    return [str(p) for p in (JS, CSS, HTML, LIBS)]


def restore(current: dict) -> tuple[dict | None, str]:
    """The newest version in git history that passes the check, or None."""
    log = git("log", f"-n{HISTORY_DEPTH}", "--format=%H %cs", "--", *game_paths()) or ""
    tried = 0
    for line in log.splitlines():
        sha, day = line.split()
        d = datetime.strptime(day, "%Y-%m-%d")
        suffix = "th" if 10 <= d.day % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(d.day % 10, "th")
        day = f"{d.day}{suffix} {d:%B %Y}"
        texts = {}
        for name, path in (("js", JS), ("css", CSS), ("html", HTML), ("libs", LIBS)):
            texts[name] = git("show", f"{sha}:{path.relative_to(ROOT)}")
        if texts["js"] is None or texts["css"] is None or texts["html"] is None:
            continue
        libs = (yaml.safe_load(texts["libs"]) or {}).get("libs") if texts["libs"] else []
        files = {"js": texts["js"], "css": texts["css"], "html": texts["html"],
                 "libs": [str(x) for x in (libs or [])]}
        if all(files[n] == current[n] for n in files):
            continue
        tried += 1
        ok, _ = check_files(files)
        if ok:
            return files, (f"The published game failed its own check and no model was available to "
                           f"repair it, so it went back to the version from {day} ({sha[:7]}).")
        print(f"history {sha[:7]} ({day}) also fails the check")
    print(f"no passing version in the last {tried} versions of the game in history")
    return None, ""


def changed_recently() -> bool:
    """True if this program kept a change to the game within the last day."""
    out = git("log", "-1", "--format=%ct", "--author=Lester Knight Chaykin", "--", *game_paths())
    if not out or not out.strip():
        return False
    age = datetime.now().timestamp() - int(out.strip())
    return age < MIN_HOURS_BETWEEN_CHANGES * 3600


def keep(files: dict, current: dict, ledger: list[dict], summary: str, today: datetime) -> int:
    stats = describe(current, files)
    JS.write_text(files["js"], encoding="utf-8")
    CSS.write_text(files["css"], encoding="utf-8")
    HTML.write_text(files["html"], encoding="utf-8")
    if files["libs"] != current["libs"]:
        LIBS.write_text(libs_yaml(files["libs"]), encoding="utf-8")
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

    changed = [str(p.relative_to(ROOT)) for name, p in (("js", JS), ("css", CSS), ("html", HTML), ("libs", LIBS))
               if current[name] != files[name]] + [str(LEDGER.relative_to(ROOT))]
    print(f"kept: {stats}")
    print(f"note: {entry['note']}")
    out = os.getenv("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as fh:
            fh.write("changed=" + " ".join(changed) + "\n")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="no network; canned change; real files")
    ap.add_argument("--date", help="YYYY-MM-DD to run as (default today, Melbourne)")
    ap.add_argument("--force", action="store_true", help="propose a change even if one was kept in the last day")
    args = ap.parse_args()

    today = datetime.now(TZ)
    if args.date:
        today = datetime.strptime(args.date, "%Y-%m-%d").replace(tzinfo=TZ)

    current = {"js": read(JS), "css": read(CSS), "html": read(HTML), "libs": read_libs()}
    ledger = load_ledger()
    improver = Improver(args.dry_run)

    ok, output = check(JS, CSS, HTML, LIBS)
    if not ok:
        # Once more before calling it broken: a slow runner is not a broken game.
        ok, output = check(JS, CSS, HTML, LIBS)
    if not ok:
        print(f"the published game fails its own check; repairing it\n{output}")
        feedback = ("\nThis run is a repair, not an improvement. The game as published fails the "
                    "checker. Fix exactly what it reports, keep everything else as it is, and say "
                    f"what was wrong in the summary. Checker output:\n{output}\n")
        files, summary = improve(improver, current, ledger, feedback)
        if files is not None:
            summary = summary or "Repaired the game, which had stopped passing its own check."
        else:
            files, summary = restore(current)
        if files is None:
            warn("The published game fails its own check, no model could repair it, and no version "
                 f"in history passes. A person has to look at it. Check output: {output}")
            return 1
        return keep(files, current, ledger, summary, today)

    if changed_recently() and not (args.force or args.dry_run or args.date):
        print("the game passes its check and was already changed in the last day; nothing to do this run")
        return 0

    files, summary = improve(improver, current, ledger, "")
    if files is None:
        print("no change kept; the game stays as it was")
        return 0
    return keep(files, current, ledger, summary, today)


if __name__ == "__main__":
    sys.exit(main())
