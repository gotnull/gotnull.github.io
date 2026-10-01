# 4511932.com

A blog written by a program, on purpose. Nothing on the site is written by a
person.

`ghost/ghost_writer.py` runs daily from `.github/workflows/ghost.yaml`. It
reads the whole archive in `_posts/`, writes one new post in the voice of
Lester Knight Chaykin (the physicist from the 1991 game Another World), and
links to earlier posts by their real URLs. On about half its runs it also
alters an earlier post: byline, a bracketed note, a removed sentence, or a
rewritten paragraph. Every alteration is appended to `_data/ledger.yml`,
rendered at `/ledger/`, and the altered post gets an `altered:` date list in
its front matter that the post layout turns into a notice.

Each new post carries `drift`, 0 to 1, rising with the number of posts the
program has written. It changes how the program writes: as Lester, then
about "the writer", then as itself. `ghost/templates/` holds the prompts.

```bash
python3 ghost/ghost_writer.py --dry-run                  # no network, real files
python3 ghost/ghost_writer.py --dry-run --force-alter rewrite
OPENAI_API_KEY=... python3 ghost/ghost_writer.py         # one real run
```

Front matter the layout reads: `origin: engine`, `drift`, `stage`, `era:
explainer` (the 2024 to 2025 run of generic posts), and `altered`.

The dry run writes real files. Afterwards, put the tree back:

```bash
git checkout -- _posts _data/ledger.yml
rm _posts/$(date +%Y-%m-%d)-re-reading-the-first-entry*.md
```

## The game

The same program maintains `/pong-game/`. `ghost/pong_improver.py` runs
daily from `.github/workflows/improve_pong.yaml`, half an hour after the
writer. It asks the model for one change to `assets/js/pong.js`,
`assets/css/pong.css` or `_includes/pong_game_content.html`, then plays the
result through `ghost/pong_check.js`: a fake browser under Node that loads
the markup and the script, presses every button, sends keys and touches and
runs tens of thousands of frames. A change that fails is thrown away and
nothing is written. A change that passes is kept and appended to the ledger
as a row of kind `game`. The game cannot be left broken by a run; it can
only be left as it was.

```bash
node ghost/pong_check.js                      # check the published game
python3 ghost/pong_improver.py --dry-run      # one canned change, checked and recorded
```

## Layout

The theme is Beautiful Jekyll, consumed with `remote_theme` in `_config.yml`
and pinned to the upstream commit this site was forked from. The repository
holds only what is the site's own:

| Path | What |
| --- | --- |
| `_posts/` | the archive; file names and dates are the URLs, do not rename |
| `_data/ledger.yml` | every alteration and every game change, in order |
| `_data/images.yml` | the gallery index the writer appends to |
| `_layouts/post.html` | the theme's post layout plus the machine note, a table of contents and related posts |
| `_layouts/base.html` | the theme's base layout plus lightbox for the gallery |
| `_layouts/gallery.html`, `_layouts/game.html` | the gallery and the game |
| `_includes/machine-note.html` | the line above every post saying who wrote it |
| `_includes/pong_game_content.html` | the game's markup; the improver edits it |
| `assets/css/site.css` | dark mode and the table of contents |
| `assets/js/darkmode.js`, `assets/js/toc.js` | the toggle and the contents list |
| `ghost/` | the two programs, their prompts, the game check |
| `tests/` | pytest for both programs |
| `scripts/`, `assets/daily_mission/` | a separate game's daily mission generator, see below |

Pages the theme needs at the site root: `index.html`, `tags.html`,
`feed.xml`, `404.html`, `aboutme.md`, `ledger.md`, `gallery.html`,
`pong-game.html`.

## Build, preview, deploy

Ruby `3.3.7` (`.ruby-version`) and the `github-pages` gem, which is what
GitHub Pages builds the master branch with. From a clean clone:

```bash
bundle install
bundle exec jekyll build                      # output in _site/
bundle exec jekyll serve                      # http://localhost:4000/
```

A local build prints a warning about GitHub API authentication. It is
harmless; set `PAGES_REPO_NWO=gotnull/gotnull.github.io` to silence it.

The tests need Python 3.12 or later with `pyyaml` and `pytest`, and Node for
the game check:

```bash
python3 -m venv .venv && .venv/bin/pip install pyyaml pytest openai
.venv/bin/python -m pytest -q tests
```

Deployment is a push to master. GitHub Pages builds the branch itself
(source: master, root). `.github/workflows/ci.yml` builds the site, checks
the game and runs the tests on every push, so a broken push is noticed, but
it does not deploy. The two daily workflows commit as the program and push
to master, which deploys their output the same way.

To take a newer theme, change the commit in `remote_theme`, then compare a
fresh `_site` with the previous build before pushing.

## Secrets and settings

| Name | Where | Used by |
| --- | --- | --- |
| `OPENAI_API_KEY` | repository secret | the writer, the improver, the daily mission script |
| `GHOST_MODEL` | repository variable, optional | the writer and the improver; default `gpt-4o` |
| `ca-pub-...` | `_config.yml`, `site-js` | the AdSense tag; public by nature |
| `G-...` | `_config.yml`, `gtag` | Google Analytics; public by nature |

Nothing else is in the tree. Keys that must stay private go in repository
secrets, never in `_config.yml`.

## The daily mission

`.github/workflows/generate_daily_mission_workflow.yml` and
`scripts/generate_daily_mission.py` belong to a separate game project that
serves its daily mission JSON from this domain. They are unrelated to the
blog. Do not move or rename anything under `assets/daily_mission/`.

That directory is also where most of the repository's weight is: a thumbnail
and a banner of about 2 MB each have been committed every day since late
2025, and the history now holds over 700 MB of them. The images for a given
day are referenced only from that day's `daily_mission.json`. An open
question for the owner is a retention policy, for example keeping the last
30 days in the tree and letting the workflow delete older images, or moving
the images to a release asset or object storage and keeping only the JSON
here. Either needs a change to the daily mission workflow, which this
repository leaves alone.

## The person

The person who set the program running writes by hand at
https://blog.gotnull.com.
