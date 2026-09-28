# Tempo — a little time for chess

A frontend-only chess and learning application built with **HTML, CSS and vanilla JavaScript** for the Web Fundamentals project. Play a friend on the same device, practice against a bot, solve puzzles and learn openings. Local profiles keep progress in the browser.

> **Status:** in development. Features, run instructions and screenshots are added as the project is committed.

## Project proposal

### Description and goals

Tempo gives beginners a quiet place to play and understand chess without an account or installation. The goals are to demonstrate responsive multi-page design, DOM manipulation, event handling, browser storage and explicit CRUD operations while providing useful chess practice.

### Specifications

- **Technology:** semantic HTML, CSS and browser JavaScript. No external JavaScript libraries, framework, backend, npm dependencies or build step.
- **Pages:** landing, Home, Play/Puzzles, Openings and Replay — five HTML pages.
- **Play:** legal chess moves, local two-player mode, a JavaScript bot, timed games, undo, board flip and move history.
- **Learning:** 24 puzzles with explanations and filters; nine annotated openings with Learn and Practice modes.
- **Persistence:** `localStorage` holds profile names, preferences, progress, results and one unfinished game per profile.
- **CRUD:** create and list profiles, rename the selected profile, and delete it with confirmation.
- **Presentation:** responsive CSS for mobile, tablet and desktop; bundled Poppins fonts and light/dark themes.
- **Audio:** a short piece-movement sound plays when sound is enabled.

### Design and user flow

1. Open `landing.html` and create or select a local profile.
2. Home (`index.html`) shows practice options, progress, recent results and any resumable match.
3. `play.html` contains game setup, the board, clocks and puzzle practice.
4. `openings.html` teaches and rehearses opening lines.
5. `replay.html` reviews newly completed games without changing the live match.
6. Home → **Manage profile** exposes name editing and confirmed profile deletion.

Page scripts handle their own interfaces. Shared helpers handle profiles, menus, sound and study boards. The chess engine and bot are separated from UI code; learning positions live in data files. All data stays in this browser. Local profiles are not authenticated accounts.

## Prerequisites

- A current desktop or mobile browser with JavaScript, localStorage and MP3 playback enabled.
- A copy of this repository, including its `assets`, `css` and `js` folders.
- No Node.js, package manager, server, API key, database or internet connection is required to run it.