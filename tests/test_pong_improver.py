"""The game improver, exercised against temporary copies of the game files.
Needs node for ghost/pong_check.js."""
import shutil
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


def test_improver_refuses_to_touch_a_game_that_already_fails(site, monkeypatch):
    pi.JS.write_text("this is not javascript (")
    assert run(monkeypatch) == 1
    assert pi.JS.read_text() == "this is not javascript ("


def test_an_unknown_library_is_not_kept(site, monkeypatch):
    bad = {"summary": "Added a library.", "libs": ["unicorn"], "js": None, "css": None, "html": None}
    monkeypatch.setattr(pi.Improver, "propose", lambda self, current, ledger, feedback: bad)
    libs_before = pi.LIBS.read_text()
    assert run(monkeypatch) == 0
    assert pi.LIBS.read_text() == libs_before
