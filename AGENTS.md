# GitHub: how to update `main`

`main` is branch-protected on GitHub (`allow_force_pushes=false`, `allow_deletions=false`, `enforce_admins=true`).

**Do**
- Sync first: `git checkout main && git pull origin main`
- Prefer a feature branch + PR for shared / risky work:
  ```bash
  git checkout -b yourname/short-topic
  # …commits…
  git push -u origin HEAD
  gh pr create --base main
  ```
- Merge the PR (or, for small solo fixes, a normal non-force push to `main` is still allowed):
  ```bash
  git checkout main && git pull
  # …commits…
  git push origin main
  ```

**Do not**
- `git push --force` / `--force-with-lease` to `main` (blocked for everyone, including admins)
- Delete `main`
- Rewrite shared history on `main`

If `main` and your branch diverge, rebase or merge your branch onto an up-to-date `main`, then open/update the PR — never force-push `main` to “fix” it.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
