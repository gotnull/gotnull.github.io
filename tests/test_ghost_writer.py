"""The writer, exercised with --dry-run against a temporary copy of the
archive. No network, no model, no change to the real tree."""
import re
import sys
from datetime import datetime
from pathlib import Path

import yaml

import ghost_writer as gw


def run(monkeypatch, *args):
    monkeypatch.setattr(sys, "argv", ["ghost_writer.py", "--dry-run", *args])
    assert gw.main() == 0


def front_matter(path: Path) -> tuple[dict, str]:
    fields, _, body = gw.split_front_matter(path.read_text(encoding="utf-8"))
    return fields, body


def test_dry_run_rewrite_writes_ledger_entry_and_altered_front_matter(site, monkeypatch):
    before = {p.name: p.read_text() for p in (site / "_posts").glob("*.md")}
    ledger_before = yaml.safe_load((site / "_data" / "ledger.yml").read_text()) or []

    run(monkeypatch, "--force-alter", "rewrite", "--date", "2026-10-02", "--seed", "7")

    ledger = yaml.safe_load((site / "_data" / "ledger.yml").read_text())
    assert len(ledger) == len(ledger_before) + 1
    entry = ledger[-1]
    assert entry["kind"] == "rewrite"
    assert entry["date"] == "2026-10-02"
    assert entry["url"].startswith("/") and entry["url"].endswith("/")
    assert entry["before"] and entry["after"] and entry["before"] != entry["after"]
    assert entry["note"] == "dry run"

    # Exactly one existing post changed, and it is the one the ledger names.
    changed = [n for n, t in before.items() if (site / "_posts" / n).read_text() != t]
    assert len(changed) == 1
    altered_path = site / "_posts" / changed[0]
    archive = {p["path"].name: p for p in gw.load_archive()}
    assert archive[changed[0]]["url"] == entry["url"]

    fields, body = front_matter(altered_path)
    assert fields["altered"] == ["2026-10-02"]
    assert entry["after"] in body
    assert entry["before"] not in body
    # The other front matter fields survive the rewrite untouched.
    old_fields, _ = gw.split_front_matter(before[changed[0]])[0], None
    for key in old_fields:
        if key != "altered":
            assert fields[key] == old_fields[key]


def test_dry_run_new_post_front_matter_and_link_validation(site, monkeypatch):
    run(monkeypatch, "--date", "2026-10-02", "--seed", "7", "--force-alter", "author")

    new = sorted((site / "_posts").glob("2026-10-02-*.md"))
    assert len(new) == 1
    fields, body = front_matter(new[0])
    assert fields["origin"] == "engine"
    assert fields["layout"] == "post"
    assert fields["comments"] is False
    assert 0 < fields["drift"] <= 1
    assert fields["stage"] in {"lester", "process", "program"}
    assert fields["date"].startswith("2026-10-02 ")
    # Two links to real posts were kept and counted, the dead one was unwrapped.
    assert fields["references"] == 2
    links = re.findall(r"\[([^\]]+)\]\(([^)]+)\)", body)
    valid = {p["url"] for p in gw.load_archive()}
    assert len(links) == 2 and all(href in valid for _, href in links)
    assert "/2099-01-01-nowhere/" not in body
    assert "[nowhere]" not in body and "nowhere" in body

    # The author change is on the record and in the file.
    ledger = yaml.safe_load((site / "_data" / "ledger.yml").read_text())
    assert ledger[-1]["kind"] == "author"
    target = next(p for p in gw.load_archive() if p["url"] == ledger[-1]["url"])
    assert target["fields"]["author"] == ledger[-1]["after"]
    assert target["altered"] == ["2026-10-02"]


def test_validate_links_keeps_real_posts_and_external_urls_only(site):
    archive = gw.load_archive()
    a = archive[0]["url"]
    body = (f"see [one]({a}), [two](https://4511932.com{a.rstrip('/')}), "
            "[dead](/2099-01-01-nowhere/), [web](https://example.com/x), [rel](about)")
    fixed, count = gw.validate_links(body, archive)
    assert count == 2
    assert fixed == f"see [one]({a}), [two]({a}), dead, [web](https://example.com/x), rel"


def test_post_url_follows_front_matter_date_in_site_timezone(site):
    # Melbourne is UTC+10 in October (AEDT, +11, from the first Sunday).
    # A post filed under one day but dated late in UTC is served under the next.
    path = Path("_posts/2026-10-01-some-title.md")
    assert gw.post_url(path, {}) == "/2026-10-01-some-title/"
    assert gw.post_url(path, {"date": "2026-10-01 09:00:00 +1000"}) == "/2026-10-01-some-title/"
    assert gw.post_url(path, {"date": "2026-10-01 23:30:00 +0000"}) == "/2026-10-02-some-title/"
    assert gw.post_url(path, {"date": datetime.strptime("2026-10-01 16:30:00 +0000", "%Y-%m-%d %H:%M:%S %z")}) == "/2026-10-02-some-title/"
    assert gw.post_url(path, {"date": "not a date"}) == "/2026-10-01-some-title/"


def test_every_archived_post_url_is_derived_from_its_file_name(site):
    for p in gw.load_archive():
        assert re.fullmatch(r"/\d{4}-\d{2}-\d{2}-[a-z0-9-]+/", p["url"]), p["url"]
        assert p["url"][11:] == p["path"].stem[10:] + "/"


def test_image_access_refusal_is_recorded_once(site, monkeypatch):
    class Refused(Exception):
        status_code = 403

    calls = []

    class Client:
        class images:
            @staticmethod
            def generate(**kw):
                calls.append(kw["model"])
                raise Refused("Your organization must be verified to use the model")

    writer = gw.Writer(dry_run=True)
    writer.dry_run = False
    writer.client = Client()
    monkeypatch.setattr(gw, "WANT_IMAGES", True)

    assert writer.image("a lamp") is None
    assert calls == ["gpt-image-1", "dall-e-3"]
    record = gw.load_image_access()
    assert set(record) == {"gpt-image-1", "dall-e-3"}

    calls.clear()
    assert writer.image("a lamp") is None
    assert calls == []  # not tried again
