import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ghost"))


@pytest.fixture
def site(tmp_path, monkeypatch):
    """A temporary copy of the parts of the site the programs read and write:
    the posts, the ledger, the config, the prompts and the game. Both
    modules are pointed at it so a test never touches the real tree."""
    import ghost_writer as gw
    import pong_improver as pi

    shutil.copytree(ROOT / "_posts", tmp_path / "_posts")
    (tmp_path / "_data").mkdir()
    shutil.copy(ROOT / "_data" / "ledger.yml", tmp_path / "_data" / "ledger.yml")
    shutil.copy(ROOT / "_config.yml", tmp_path / "_config.yml")
    shutil.copytree(ROOT / "ghost" / "templates", tmp_path / "ghost" / "templates")
    shutil.copy(ROOT / "ghost" / "pong_check.js", tmp_path / "ghost" / "pong_check.js")
    (tmp_path / "assets" / "js").mkdir(parents=True)
    (tmp_path / "assets" / "css").mkdir(parents=True)
    (tmp_path / "_includes").mkdir()
    shutil.copy(ROOT / "assets" / "js" / "pong.js", tmp_path / "assets" / "js" / "pong.js")
    shutil.copy(ROOT / "assets" / "css" / "pong.css", tmp_path / "assets" / "css" / "pong.css")
    shutil.copy(ROOT / "_includes" / "pong_game_content.html", tmp_path / "_includes" / "pong_game_content.html")

    monkeypatch.setattr(gw, "ROOT", tmp_path)
    monkeypatch.setattr(gw, "POSTS", tmp_path / "_posts")
    monkeypatch.setattr(gw, "LEDGER", tmp_path / "_data" / "ledger.yml")
    monkeypatch.setattr(gw, "IMAGES", tmp_path / "assets" / "img" / "posts")
    monkeypatch.setattr(gw, "IMAGES_INDEX", tmp_path / "_data" / "images.yml")
    monkeypatch.setattr(gw, "TEMPLATES", tmp_path / "ghost" / "templates")
    monkeypatch.setattr(gw, "IMAGE_ACCESS", tmp_path / "ghost" / "image_access.json")

    monkeypatch.setattr(pi, "ROOT", tmp_path)
    monkeypatch.setattr(pi, "JS", tmp_path / "assets" / "js" / "pong.js")
    monkeypatch.setattr(pi, "CSS", tmp_path / "assets" / "css" / "pong.css")
    monkeypatch.setattr(pi, "HTML", tmp_path / "_includes" / "pong_game_content.html")
    monkeypatch.setattr(pi, "LEDGER", tmp_path / "_data" / "ledger.yml")
    monkeypatch.setattr(pi, "CHECK", tmp_path / "ghost" / "pong_check.js")
    monkeypatch.delenv("GITHUB_OUTPUT", raising=False)
    return tmp_path
