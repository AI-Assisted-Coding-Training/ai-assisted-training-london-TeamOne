---
name: implement-ticket
description: Implement a backlog ticket (for example PPO-7) in the Planning Poker frontend. Fetches the latest ticket from the remote with the Backlog Assistant, then builds it to meet its acceptance criteria. Use whenever the user asks to implement, build, work on, pick up or code a ticket, story or backlog item, or gives a ticket key such as PPO-7, even if they do not mention the backlog.
---

Implement a story from the backlog. The ticket is the source of truth for what to build; AGENTS.md and `docs/api-contract.md` define the constraints.

## Steps

1. **Identify the ticket.** Use the key the user gave (for example `PPO-7`). If none was given, list the files in `.backlog/remote/` and ask which story to implement. Do not implement epics directly; ask which of their stories to start with.

2. **Fetch the latest ticket.** Call the Backlog Assistant fetch-ticket-from-remote tool with the key. This overwrites the file in `.backlog/remote/`, so tell the user if it would discard local edits (check `git status --short .backlog` first and ask before fetching).

3. **Read the context.** Read the fetched `.ticket` file, then `AGENTS.md`, `docs/api-contract.md`, and the parent epic (the `epicKey` in the ticket front matter) from `.backlog/remote/`. Check which related stories are already implemented in the repository.

4. **Check the ticket is ready.** Stop and report back, without writing code, if any of these is true:
   - Acceptance Criteria, Technical Notes or Testing Notes are empty.
   - An acceptance criterion needs something the API contract cannot do (the contract is fixed and must not change).
   - Technical Notes list an open question that affects the work.
   - It depends on a story that is not implemented yet.

   Offer to refine the ticket with the Backlog Assistant agent instead.

5. **Plan.** Break the work into a short todo list, one item per acceptance criterion or small group of them. Confirm the plan with the user when the ticket is large or the tech stack has not been chosen yet. Any stack is allowed if it builds to a static site deployable to GitHub Pages.

6. **Implement.**
   - Work on a branch named after the ticket, for example `ppo-7-vote-and-reveal`. Do not commit to `main`.
   - Build only what the acceptance criteria require. Respect the ticket's Out of Scope section.
   - Integrate with the API contract as written; derive UI state from the `state` snapshot rather than local assumptions.
   - Write tests for the logic described in Testing Notes.

7. **Verify.** Run the build and the tests, and fix failures. Walk through each acceptance criterion and the manual checks in Testing Notes, and report which pass and which could not be verified.

8. **Keep AGENTS.md current.** If the change affects the project description, architecture, guidelines, tech stack or folder structure, update AGENTS.md in the same change.

9. **Report.** Summarise what was implemented per acceptance criterion (AC01, AC02, ...), anything left undone and why, and any ticket problems found. Offer to open a pull request with the create-pull-request skill.

## Rules

- Never modify `docs/api-contract.md`.
- Never edit the `.ticket` file or push ticket changes to the ticketing system. Report ticket problems to the user instead.
- Never commit, push or merge unless the user asks.
- If a requirement is ambiguous, ask rather than guess.
