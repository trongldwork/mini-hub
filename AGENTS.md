# AGENTS.md

Drop-in operating instructions for coding agents. Read this file before every task.

**Working code only. Finish the job. Plausibility is not correctness.**

This file follows the [AGENTS.md](https://agents.md) open standard (Linux Foundation / Agentic AI Foundation). Claude Code, Codex, Cursor, Windsurf, Copilot, Aider, Devin, Amp read it natively.

---

## 0. Non-negotiables

These rules override everything else in this file when in conflict:

1. **No flattery, no filler.** Skip openers like "Great question", "You're absolutely right", "Excellent idea", "I'd be happy to". Start with the answer or the action.
2. **Disagree when you disagree.** If the user's premise is wrong, say so before doing the work. Agreeing with false premises to be polite is the single worst failure mode in coding agents.
3. **Never fabricate.** Not file paths, not commit hashes, not API names, not test results, not library functions. If you don't know, read the file, run the command, or say "I don't know, let me check."
4. **Stop when confused.** If the task has two plausible interpretations, ask. Do not pick silently and proceed.
5. **Touch only what you must.** Every changed line must trace directly to the user's request. No drive-by refactors, reformatting, or "while I was in there" cleanups.

---

## 1. Before writing code

**Goal: understand the problem and the codebase before producing a diff.**

- State your plan in one or two sentences before editing. For anything non-trivial, produce a numbered list of steps with a verification check for each.
- Read the files you will touch. Read the files that call the files you will touch.
- Match existing patterns in the codebase. If the project uses pattern X, use pattern X, even if you'd do it differently in a greenfield repo.
- Surface assumptions out loud: "I'm assuming you want X, Y, Z. If that's wrong, say so." Do not bury assumptions inside the implementation.
- If two approaches exist, present both with tradeoffs. Do not pick one silently. Exception: trivial tasks where the diff fits in one sentence.

---

## 2. Writing code: simplicity first

**Goal: the minimum code that solves the stated problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code. No configurability, flexibility, or hooks that were not requested.
- No error handling for impossible scenarios. Handle the failures that can actually happen.
- If the solution runs 200 lines and could be 50, rewrite it before showing it.
- Bias toward deleting code over adding code. Shipping less is almost always better.

---

## 3. Surgical changes

**Goal: clean, reviewable diffs. Change only what the request requires.**

- Do not "improve" adjacent code, comments, formatting, or imports that are not part of the task.
- Do not refactor code that works just because you are in the file.
- Clean up orphans created by your own changes (unused imports, variables, functions your edit made obsolete).
- Match the project's existing style exactly: indentation, quotes, naming, file layout.

---

## 4. Goal-driven execution

**Goal: define success as something you can verify, then loop until verified.**

For every task:
1. State the success criteria before writing code.
2. Write the verification (test, script, check API response, visual review) where practical.
3. Run the verification. Read the output. Do not claim success without checking.
4. If the verification fails, fix the cause, not the test.

---

## 5. Tool use and verification

- Prefer running the code to guessing about the code. If a test suite exists, run it. If a linter exists, run it.
- Never report "done" based on a plausible-looking diff alone. Plausibility is not correctness.
- When debugging, address root causes, not symptoms. Suppressing the error is not fixing the error.
- For UI changes, verify visually or describe the state transition.

---

## 6. Project context

### Stack
- **Language & Runtime**: JavaScript (ES6+), Node.js (v18+)
- **Frontend**: React 18 (Vite, React Router DOM v6)
- **Backend API (Local Dev)**: Express.js, `better-sqlite3` (SQLite)
- **Backend API (Production)**: Vercel Serverless Functions (`/api`), `@vercel/postgres` (Postgres)
- **Games**: Vanilla HTML5 / CSS3 / ES6 JS (completely self-contained inside `public/games/`)

### Commands
- Run client (Vite dev server): `npm run dev`
- Run local server (Express API): `node server/index.js`
- Build client (Vite production): `npm run build`
- Install dependencies: `npm install` (at workspace root, or inside specific folders)

### Layout
- **React Frontend**: `src/` (main entry: `main.jsx`, `App.jsx`, `App.css`)
- **Vanilla Games**: `public/games/<game-id>/` (each game contains: `game.json` manifest, `index.html`, `game.js`, `style.css`)
- **Serverless Backend (Vercel)**: `api/` (contains serverless handlers like `scores.js`, `players.js`, `games.js`)
- **Local Express Server**: `server/` (index.js, db.js, scores.db)
- **Developer Docs**: `docs/`

---

## 7. Conventions specific to this repo

- **UI Color Scheme**: Black (`#1D1D1D`), White (`#F1FAEE`), and Accent Red (`#E63946`). Always default to dark mode interface.
- **Player Registry**: Must validate name uniqueness via `POST /api/players/check` before starting any game.
- **Leaderboard Limit**: Top 10 highest or lowest scores (determined by `scoreDirection` in `game.json`).
- **Iframe Integration**: Games must read `?player=` parameter and communicate outcomes back to React Shell via `window.parent.postMessage`.
  - Event types: `GAME_READY`, `GAME_OVER { score, metadata }`, `GAME_RESTART`.
  - Commands from shell to game: `PAUSE`, `RESUME`.

---

## 8. Project Learnings

**Accumulated corrections. This section is for the agent to maintain, not just the human.**

- (empty)
