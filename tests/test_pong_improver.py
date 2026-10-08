"""The game improver, exercised against temporary copies of the game files.
Needs node for ghost/pong_check.js."""
import shutil
import subprocess
import sys

import pytest
import yaml

import pong_improver as pi

pytestmark = pytest.mark.skipif(shutil.which("node") is None or not (pi.ROOT / "ghost" / "node_modules").exists(),
                                reason="node and puppeteer-core (npm install --prefix ghost) are required for pong_check.js")


def run(monkeypatch, *args):
    monkeypatch.setattr(sys, "argv", ["pong_improver.py", "--dry-run", "--date", "2026-10-02", *args])
    return pi.main()


def test_current_game_passes_its_check(site):
    ok, output = pi.check(pi.JS, pi.CSS, pi.HTML)
    assert ok, output


def test_dry_run_keeps_a_passing_change_and_records_it(site, monkeypatch):
    js_before = pi.JS.read_text()
    ledger_before = yaml.safe_load(pi.LEDGER.read_text())
    assert run(monkeypatch) == 0
    assert pi.JS.read_text() != js_before
    ledger = yaml.safe_load(pi.LEDGER.read_text())
    assert len(ledger) == len(ledger_before) + 1
    entry = ledger[-1]
    assert entry["kind"] == "game"
    assert entry["url"] == "/pong-game/"
    assert entry["date"] == "2026-10-02"
    assert entry["after"] == "js +1 -0"
    assert entry["note"]
    # The kept game still passes.
    ok, output = pi.check(pi.JS, pi.CSS, pi.HTML)
    assert ok, output


def test_a_change_that_fails_the_check_is_not_kept(site, monkeypatch):
    broken = {"summary": "Broke it.", "libs": [], "js": "var x = ;", "css": None, "html": None}
    monkeypatch.setattr(pi.Improver, "propose", lambda self, current, ledger, feedback: broken)
    js_before, css_before, html_before = pi.JS.read_text(), pi.CSS.read_text(), pi.HTML.read_text()
    ledger_before = pi.LEDGER.read_text()
    assert run(monkeypatch) == 0
    assert (pi.JS.read_text(), pi.CSS.read_text(), pi.HTML.read_text()) == (js_before, css_before, html_before)
    assert pi.LEDGER.read_text() == ledger_before


def test_markup_that_drops_an_id_is_not_kept(site, monkeypatch):
    html = pi.HTML.read_text().replace('id="pauseGame"', 'id="pauseButton"')
    bad = {"summary": "Renamed a button.", "libs": [], "js": None, "css": None, "html": html}
    monkeypatch.setattr(pi.Improver, "propose", lambda self, current, ledger, feedback: bad)
    html_before = pi.HTML.read_text()
    assert run(monkeypatch) == 0
    assert pi.HTML.read_text() == html_before


def refuse(self, current, ledger, feedback):
    raise pi.NoModel("openai (gpt-4o): no credits remaining")


def test_a_broken_game_is_repaired_by_the_model(site, monkeypatch):
    good = pi.JS.read_text()
    pi.JS.write_text("this is not javascript (")
    asked = []

    def fix(self, current, ledger, feedback):
        asked.append(feedback)
        return {"summary": "Put the script back together.", "libs": current["libs"], "js": good,
                "css": None, "html": None}
    monkeypatch.setattr(pi.Improver, "propose", fix)
    assert run(monkeypatch) == 0
    assert pi.JS.read_text() == good
    assert "repair" in asked[0]
    assert yaml.safe_load(pi.LEDGER.read_text())[-1]["note"] == "Put the script back together."


def test_a_broken_game_with_no_model_is_restored_from_history(site, monkeypatch):
    def git(*args):
        subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", *args], cwd=site,
                       check=True, capture_output=True)
    good = pi.JS.read_text()
    git("init", "-q")
    git("add", "-A")
    git("commit", "-q", "-m", "a game that works")
    pi.JS.write_text("this is not javascript (")
    git("commit", "-q", "-am", "a game that does not")
    monkeypatch.setattr(pi.Improver, "propose", refuse)
    assert run(monkeypatch) == 0
    assert pi.JS.read_text() == good
    assert "went back to the version from" in yaml.safe_load(pi.LEDGER.read_text())[-1]["note"]


def test_a_broken_game_nothing_can_fix_is_left_alone_and_fails_loudly(site, monkeypatch):
    pi.JS.write_text("this is not javascript (")
    monkeypatch.setattr(pi.Improver, "propose", refuse)
    assert run(monkeypatch) == 1
    assert pi.JS.read_text() == "this is not javascript ("


def test_no_model_leaves_a_working_game_alone_and_does_not_fail(site, monkeypatch):
    js_before, ledger_before = pi.JS.read_text(), pi.LEDGER.read_text()
    monkeypatch.setattr(pi.Improver, "propose", refuse)
    assert run(monkeypatch) == 0
    assert (pi.JS.read_text(), pi.LEDGER.read_text()) == (js_before, ledger_before)


def test_an_unknown_library_is_not_kept(site, monkeypatch):
    bad = {"summary": "Added a library.", "libs": ["unicorn"], "js": None, "css": None, "html": None}
    monkeypatch.setattr(pi.Improver, "propose", lambda self, current, ledger, feedback: bad)
    libs_before = pi.LIBS.read_text()
    assert run(monkeypatch) == 0
    assert pi.LIBS.read_text() == libs_before
