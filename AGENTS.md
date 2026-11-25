# AGENTS.md

## Project

Planning Poker: a web application for agile estimation. Team members join a shared room, vote privately on a work item, reveal the votes together and agree on an estimate.

## Architecture

- **Frontend** — this repository. A static web application deployed to GitHub Pages.
- **Backend** — an existing service, maintained separately. The frontend talks to it over WebSocket as described in [docs/api-contract.md](docs/api-contract.md).

## Guidelines

- The [API contract](docs/api-contract.md) is fixed. Integrate with it; do not change it.
- Features, UI and behaviour are defined by the project backlog (epics, stories, acceptance criteria), which is the source of truth.
- Any frontend tech stack is allowed, provided it builds to a static site deployable to GitHub Pages.

## Structure

| Path | Contents |
|---|---|
| `docs/` | Project documentation, including the API contract |
| `tools/` | Developer tooling |
