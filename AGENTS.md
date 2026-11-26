# AGENTS.md

## Project

Planning Poker: a web application for agile estimation. Team members join a shared room, vote privately on a work item, reveal the votes together and agree on an estimate.

## Architecture

- **Frontend** — this repository. A static web application deployed to GitHub Pages. The app is plain HTML, CSS and ES modules with no build step. Pure logic lives in `app/src/logic.js` and is unit-tested with Node's built-in `node:test` (`npm test`).
- **Backend** — an existing service, maintained separately. The frontend talks to it over WebSocket as described in [docs/api-contract.md](docs/api-contract.md).

## Guidelines

- The [API contract](docs/api-contract.md) is fixed. Integrate with it; do not change it.
- Features, UI and behaviour are defined by the project backlog (epics, stories, acceptance criteria), which is the source of truth.
- Any frontend tech stack is allowed, provided it builds to a static site deployable to GitHub Pages.
- Keep this file current: when a change affects the project description, architecture, guidelines, tech stack or folder structure, update AGENTS.md in the same change.

## Structure

| Path | Contents |
|---|---|
| `index.html` | Static informational page about planning poker (plain HTML, no functionality) |
| `app/` | The Planning Poker application: `index.html`, `styles.css`, and `src/` (`main.js` controller, `logic.js` pure logic, `socket.js` WebSocket wrapper, `fireworks.js` celebration) |
| `tests/` | Unit tests for `app/src/logic.js` (`logic.test.js`) |
| `package.json` | Node project file (ES modules; `npm test` runs the tests) |
| `.github/workflows/` | GitHub Actions workflows; `deploy-pages.yml` deploys `index.html` and `app/` to GitHub Pages on push to `main` |
| `docs/` | Project documentation, including the API contract |
| `tools/` | Developer tooling |
