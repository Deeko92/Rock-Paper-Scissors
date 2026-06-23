# ✊✋✌️ RPS Tracker

A tiny, private rock-paper-scissors tracker. Log each game, see your stats, and
keep a running win–loss record. No accounts, no server — everything is saved in
your phone's browser.

## How a game works
Each **game** is *sudden death*: you play rounds until one round has a winner —
that round decides the game. **Ties replay** but are still counted in the stats
(every throw and a running total-ties counter). Pick each player's throw, hit
**Submit round**, and the app announces the winner when a round is decided.

## What it tracks
**Per player**
- Throw distribution (rock / paper / scissors) with percentages
- Opening move — what you throw on round 1 of each game
- Win–loss record and win %
- Current and best win streak
- "Lucky" throw — the throw you win deciding rounds with most
- After-a-tie tendency (switch vs repeat)

**Overall**
- Total games, rounds, and ties; tie rate; average rounds per game
- Longest game
- Most common matchup
- Most decisive throw

## Use it on your phone
1. Open the site (see *Deploy* below).
2. In Safari/Chrome, use **Share → Add to Home Screen**. It launches full-screen
   like an app and works offline.
3. Data lives in that browser. Use **History → Export** to download a JSON
   backup, and **Import** to restore it (handy before clearing data or switching
   phones).

> Note: data is stored on the one device. There's no cross-device sync by design.
> Export/import is the backup mechanism.

## Run locally
No build step. From the project folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. (Open via a server, not the `file://` path, so
the service worker and manifest load.)

## Deploy to GitHub Pages
1. Merge this branch into your default branch.
2. Repo **Settings → Pages → Build and deployment**: set **Source** to *Deploy
   from a branch*, branch = your default branch, folder = `/ (root)`.
3. After it builds, the app is at
   `https://deeko92.github.io/rock-paper-scissors/`.

## Project layout
```
index.html            app shell + bottom tab bar (Play / Stats / History)
css/styles.css        mobile-first styling
js/storage.js         localStorage load/save + export/import
js/game.js            RPS rules + sudden-death game logic
js/stats.js           all stats, derived from the raw games list
js/app.js             UI rendering and interaction
manifest.webmanifest  Add-to-Home-Screen metadata
sw.js                 minimal offline cache
icon.svg              app icon
```
