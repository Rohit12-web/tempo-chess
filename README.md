# TempoChess

A frontend-only chess and learning application built with **HTML, CSS and vanilla JavaScript** for the Web Fundamentals project. Play a friend on the same device, practice against a bot, solve puzzles and learn openings. Versioned local accounts keep progress in the browser.

**GitHub:** [Rohit12-web/tempo-chess](https://github.com/Rohit12-web/tempo-chess)

## Project proposal

### Description and goals

TempoChess gives beginners a quiet place to play and understand chess without an account or installation. The goals are to demonstrate responsive multi-page design, DOM manipulation, event handling, browser storage and explicit CRUD operations while providing useful chess practice.

### Specifications

- **Technology:** semantic HTML, CSS and browser JavaScript. No external JavaScript libraries, framework, backend, npm dependencies or build step.

- **Pages:** Landing, Login, Sign up, Home, Play/Puzzles, Openings, Replay, Notebook, Progress, Learn and the separate administrator Puzzle Manager.

- **Play:** legal chess moves, local two-player mode, a JavaScript bot, timed games, undo, board flip and move history.

- **Learning:** 30 built-in puzzles (including six multi-move sequences), mistake review, practice statistics, nine annotated openings and five beginner rule lessons.

- **Persistence:** `localStorage` holds versioned account records, salted PBKDF2 password hashes, preferences, progress, results, shared custom puzzles and one unfinished game per player. `sessionStorage` is intentionally not used for passwords; the current session stores only an account ID.

- **CRUD:** create/read/update/delete local profiles and personal notebook entries.

- **Presentation:** responsive CSS for mobile, tablet and desktop, including narrow-phone navigation and game-board safeguards; every HTML entry point includes the bundled SVG favicon, Poppins fonts and light/dark themes.

- **Audio:** the supplied `move-self.mp3` plays for piece movement when sound is enabled.

### Design and user flow

1. Open `landing.html` and choose **Get started** to sign up, or **Log in** for an existing account.

2. Home (`index.html`) shows practice options, progress, recent results and any resumable match.

3. `play.html` contains game setup, the board, clocks and puzzle practice.

4. `openings.html` teaches and rehearses opening lines.

5. `replay.html` reviews newly completed games without changing the live match.

6. `notebook.html` stores personal position notes; `statistics.html` shows observed practice and mistakes.

7. `lessons.html` teaches five beginner rules with interactive boards.

8. The player sidebar shows the display name, login username and a logout button. Account credentials are managed through the local login flow.

Page scripts handle their own interfaces. Shared helpers handle accounts, the compatibility profile API, menus, sound and study boards. The chess engine and bot are separated from UI code; learning positions live in data files. All data stays in this browser. Browser-side authentication is a local academic demonstration: anyone controlling the browser can inspect or bypass it, and it is not server-enforced public-site authorization.

## Prerequisites

- A current desktop or mobile browser with JavaScript, localStorage and MP3 playback enabled.

- The complete extracted project folder, including its `assets`, `css` and `js` subfolders.

- No Node.js, package manager, API key, database or application backend is required. For reliable storage across pages, use static localhost hosting or HTTPS. The admin password lock requires Web Crypto.

## Run the application

1. Download the project ZIP from the GitHub repository and extract it.

2. Open the extracted folder containing `landing.html`.

3. Double-click **`landing.html`** to open it in your browser.

4. Choose **Get started** and create a display name, unique username and password, or use **Log in**.

5. Choose Play, Puzzles, Openings, Notebook, Progress or Learn from Home.

6. Expand **Board & sound** on pages opened after selecting a profile to enable the bundled MP3, adjust volume or choose a high-contrast board. New profiles start muted; preferences persist per profile.

Keep all folders together. If updating an older copy, keep the old folder as a precaution, then replace its files in the same working location. Storage for directly opened HTML files varies by browser and can depend on the file path. Use the same browser and location to preserve access to existing progress. Optional static hosting can provide a consistent origin, but deployment is not required for this project.

## Folder structure

```text
tempo-chess/
├── admin.html
├── landing.html
├── index.html
├── play.html
├── openings.html
├── replay.html
├── notebook.html, statistics.html, lessons.html
├── css/
│   ├── styles.css
│   ├── site.css
│   ├── learning.css
│   ├── study-tools.css
│   └── admin.css
├── js/
│   ├── admin.js, app.js, home.js, landing.js
│   ├── puzzles.js, openings.js, replay.js, auth.js
│   ├── notebook.js, statistics.js, lessons.js
│   ├── core/       # engine.js, bot.js, bot-worker.js
│   ├── data/       # puzzle-data.js, opening-data.js, lesson-data.js
│   └── helpers/    # profiles, saved games, sound, menus, theme and boards
├── assets/
│   ├── audio/move-self.mp3
│   ├── Poppins-*.ttf, chess.woff, favicon.svg
│   └── font licenses and ASSET-NOTES.md
├── .gitignore
├── LICENSE
├── tests/admin.test.cjs
├── ADMIN-GUIDE.md
├── README.md
└── START-HERE.md
```

## CRUD demonstration

| Operation | How to demonstrate it | Stored result |
| --------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Create | Landing → create a display-name profile | New ID and name |
| Read | Open the profile chooser; select a profile and view Home | Existing profiles and progress |
| Update | Home → Manage profile → edit name → Save name | Same ID and progress; updated name |
| Delete | Home → Manage profile → Delete profile → Delete permanently | Selected profile and its progress removed; other profiles retained |

Player usernames contain 3–24 letters, numbers, underscores or hyphens and are unique without regard to case. `Rohit` and the legacy `admin` username are reserved. Passwords are 8–128 characters and are never stored as readable text. Display names can contain ordinary user text and are rendered with `textContent`.

## Features and behavior

### Games, recovery and replay

Two-player means two people sharing this device. Bot play stays entirely in browser JavaScript. The browser Web Worker is not a server; the file-opening path uses an in-memory worker with a fallback. Time controls are 1, 3, 5, 10 and 30 minutes per side.

A match with moves is saved after game-state changes, periodically while its clock runs, and during normal leave/visibility events. Home offers **Continue game**. Saved move lists rebuild the legal position, castling rights, en passant, repetition history and undo state through the chess engine. Starting a different game asks before replacing the unfinished match.

Clocks pause while away, in dialogs and during puzzle practice. Offline time is not charged. Browsers may suppress reload/close warnings; autosave provides recovery. An abrupt crash may lose the most recent unsaved change. Use one active tab per profile to avoid conflicting updates.

Newly completed games have **Replay** links on Home, with step controls, move selection, flip and playback. The latest 50 results are retained. Older results without move lists remain visible and explicitly say they have no replay record.

### Puzzles and practice review

The built-in collection contains 30 puzzles, including six multi-move sequences. Theme, difficulty, completion, multi-move and review filters narrow the collection. Make your move, wait for the automatic reply, then finish the line. Reset/skip cancels pending replies; a hidden page pauses the sequence. Mate exercises also accept an immediate legal checkmate. Other sequences demonstrate a selected reply, not an exhaustive engine analysis of all defenses.

Wrong answers, hints and solution reveals put a puzzle into **Practice mistakes**. A fresh completion with no wrong answer, hint or reveal clears it. Assisted completion remains practice rather than an unaided solved record. Revealing a line does not claim a successful solve. An empty review queue displays an empty state.

**Progress** records new observed attempts, clean completions, wrong answers, hint requests, reveals and theme results. An attempt begins with the first submitted legal answer, hint or reveal; merely opening a puzzle does not count. Partial multi-move attempts count even if abandoned. “First-attempt success” means a clean completion within that recorded attempt, not necessarily the first lifetime visit to that puzzle. Retry creates a new attempt. Older completions remain saved but do not invent historical accuracy. Statistics are practice aids, not a chess rating.

### Openings

Nine opening lessons cover Ruy Lopez, Italian Game, Scotch Game, Sicilian Defense, French Defense, Caro-Kann Defense, Queen's Gambit, King's Indian Defense and London System. Learn mode explains each move. Practice mode supports White, Black or both sides. A legal move outside the selected lesson is described as a different continuation. Lessons illustrate one line per opening, not exhaustive opening theory.

After reaching the end of a lesson, **Play from here** continues against the bot with your selected side, level and time control. An existing unfinished match requires an explicit replace/keep choice. The full opening prefix is retained for legal reconstruction and replay; Undo cannot cross the starting lesson position. The new game starts with fresh clocks.

### Beginner rules

**Learn** contains five guided exercises: castling, en passant, promotion, checkmate and stalemate. Each offers an explanation and interactive position, with completion saved per profile.

### Recent games

Home can search the latest 50 results and filter by game mode and result. Opening-based games can be found by opening name. Old results without move records remain readable without offering an invalid replay.

### Sound

`assets/audio/move-self.mp3` is the bundled move recording. Play, Puzzles and Openings share the same audio helper and sound preference. The shared **Board & sound** control is also available directly on Openings. Sound, volume and board contrast are profile preferences; high-contrast colors support both themes. The recording is played at its original pitch; there is no synthesized fallback or custom sound upload panel. Muting, hiding the page or leaving stops playback. A missing/blocked sound cannot prevent a legal move.

## Storage and authentication

| Key | Purpose |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `tempo-accounts-v1` | Versioned player/admin accounts and salted PBKDF2-SHA-256 password records |
| `tempo-session-v1` | Current tab's account ID and session timestamp; never a password |
| `tempo-local-profiles` | One-time legacy profile list used for migration only |
| `tempo-local-progress:<id>` | Preferences, puzzle/opening/lesson progress, observed puzzle attempts, notebook entries, recent games and active match |
| `tempo-theme` | Theme preference |

There is no email recovery, OTP, backend, online multiplayer or cross-device synchronization. Password hashing uses Web Crypto PBKDF2-SHA-256 with a unique random salt per account. Anyone controlling this browser can inspect or bypass browser-side checks; this is not a security boundary or public-site authentication.

Clearing browser data or deleting a profile removes progress. Private browsing may discard it. Full or blocked storage can prevent saves; errors are surfaced rather than reported as successful. There is no progress export/import or custom sound upload feature.

## Verification and manual evaluation

Use the following checklist to evaluate the application. These are test steps, not a claim that browser testing has been completed. Record the browser, device or viewport, date, actual result and any issues in `TESTING.md` when you perform the checks.

1. Sign up two player accounts; verify password mismatch, incorrect password, duplicate usernames with different capitalisation, reserved Rohit/admin names, logout, reload and back navigation.

2. Save a puzzle and a replay position to Notebook. Search, edit and delete notes; log in as the second account and verify isolation.

3. Play local and bot games; refresh/resume and check clocks/undo. Finish and replay a game; search/filter recent results.

4. Complete a multi-move puzzle, retry during its automatic reply and switch away/back. Make a mistake or request a hint; find it in review. Retry cleanly and verify it leaves review.

5. Log in as Rohit with the demo credentials, publish a custom puzzle, change the admin password, reload, and verify a player cannot open the dashboard. Existing custom puzzles must remain after player migration/deletion.

6. Finish an opening, choose Play from here, test both keep/replace choices for an existing game, then reload/resume. Undo must stop at the opening setup.

7. Complete all five beginner lessons. Verify persisted completion after reload.

8. At approximately 375 px, 768 px and 1440 px, check every page, dialog and dropdown in both themes and high contrast. Use keyboard focus, Enter and Escape.

9. Enable sound, change volume and mute on Openings and Play; listen to the supplied MP3 after user interaction. Check hiding a page stops playback.

## License and asset attribution

The project source is distributed under the MIT license in `LICENSE`. Poppins uses the SIL Open Font License (`assets/POPPINS-LICENSE.txt`); the chess glyph font license is in `assets/FONT-LICENSE.txt`. The audio was supplied as `move-self.mp3`; its original author/source/license was not provided. The MIT source-code license does not grant rights to third-party assets. See `assets/ASSET-NOTES.md`.

## Personal notebook

Save the visible position from Puzzles or Replay, add a title and note, and manage it on `notebook.html`. Notes can be searched, edited and deleted with confirmation. Each profile can keep up to 200 notes. New note starts from the initial board. Positions are stored as validated FEN snapshots; notes are personal observations, not engine analysis.

## Troubleshooting

- **No move sound:** Log in, open Board & sound, enable
  sound and increase the volume. Check that your browser tab is not muted.
- **Saved progress is missing:** Use the same browser and project
  location. Private browsing or clearing browser data can remove progress.
- **Styles or pieces are missing:** Keep the assets, css and js folders
  beside the HTML files and extract the complete project before opening it.

## Local puzzle manager

Use the normal `login.html` entry point. The administrator username is **Rohit**, with the initial demonstration password **rohit@128**. Change it from the separate `admin.html` dashboard. There is no public Puzzle Manager link and `admin` is no longer an alternative login.

The manager supports custom puzzle CRUD, search, difficulty/visibility filters, legal-position and move-sequence checks, a step-through board preview, and draft/publish controls. Use **Load example** to start with a working position. Publish a puzzle to make it available under **Custom puzzles** in the player collection. The 30 built-in puzzles remain unchanged.

Custom puzzles are stored separately from player profiles and shared across profiles on the same browser origin. Deleting a player profile does not delete the custom collection or the admin password. Editing a position or solution starts a new puzzle revision so old completion records are not counted against a different solution.

This is a local management tool, not secure server-side administration. Its access lock can be bypassed by someone who controls the browser. Publishing does not upload data to GitHub or distribute puzzles to other devices. The app uses no external JavaScript libraries or backend.

For reliable shared storage between pages, serve the folder from one static localhost address or HTTPS site. Directly opened file URLs have browser-dependent storage behavior. See [ADMIN-GUIDE.md](ADMIN-GUIDE.md) for setup, puzzle entry and local-only limitations. There is no server password recovery; changing or clearing browser data is not a routine recovery mechanism.

### Optional development tests

The app itself does not need Node.js. To run the included dependency-free helper tests with Node.js 20 or later:

```sh
node --test tests/*.test.cjs
```
