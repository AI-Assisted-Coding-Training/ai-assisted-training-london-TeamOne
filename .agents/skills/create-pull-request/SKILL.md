---
name: create-pull-request
description: Create a GitHub pull request using the gh CLI, asking the user for the PR description first. Use whenever the user wants to open, raise, create or submit a pull request or PR, even if they don't mention gh.
---

Open a pull request with the `gh` CLI. Always ask the user for the description before creating it.

## Steps

1. **Check prerequisites.** Run `gh auth status`. If it fails, tell the user to run `gh auth login` and stop.

2. **Inspect the branch.** Run:
   - `git branch --show-current`
   - `git status --short`
   - `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name` (the base branch)
   - `git log <base>..HEAD --oneline`

   Stop and tell the user if the current branch is the base branch, or if there are no commits ahead of it. If there are uncommitted changes, mention them and ask whether to continue without them.

3. **Push the branch** if it has no upstream or is ahead of it: `git push -u origin <branch>`. Do not force push.

4. **Ask the user about the description.** Do not invent one. Ask in a single round, offering a recommended answer for each:
   - **Title**: suggest one from the branch name and commits.
   - **Description**: what changed and why. Offer a draft built from the commit log and diff summary (`git diff <base>...HEAD --stat`), and ask the user to accept or edit it.
   - **Draft or ready for review**: recommend ready for review.
   - **Optional**: reviewers, labels, and linked issues (e.g. `Closes #123`).

   Wait for the answers before continuing.

5. **Create the PR.** Write the body to a temporary file to preserve formatting, then pass it with `--body-file`:

   ```powershell
   $body = New-TemporaryFile
   Set-Content -Path $body -Value $description -Encoding utf8
   gh pr create --base <base> --title "<title>" --body-file $body [--draft] [--reviewer <user>] [--label <label>]
   Remove-Item $body
   ```

6. **Report** the PR URL printed by `gh pr create`.

## Rules

- Never create the PR before the user has confirmed the title and description.
- Never force push, and never push to the base branch.
- If a PR already exists for the branch (`gh pr view` succeeds), show its URL and ask whether to update it with `gh pr edit` instead.
