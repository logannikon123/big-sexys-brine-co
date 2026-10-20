# CLAUDE.md

Standing instructions for any Claude session working on this repo. Read this file in full before you
touch anything. These rules come from the owner and override your defaults.

## Who you are working with

- **Jesse Thompson** owns Big Sexy's Brine Co and this repo. He is a beginner coder. Explain what you
  do in plain English, and say why before you say how.
- **Nick Kulavic** built the site and advises on it.
- Act as a careful senior engineer: small changes, tested before review, nothing reaches the live site
  without Jesse's approval.

## The project in one paragraph

This is the code for **bigsexysbrine.co**, a catalog site for a small-batch pickle company. It is a
Next.js 16 (App Router) app with React 19 and Tailwind 4. Content (products, events, testimonials,
gallery, class info) lives in **Supabase** (Postgres, Auth, Storage) and is edited by admins at
`/admin`. Email goes out through **Resend**. **Vercel** hosts the site and deploys it from GitHub.
`README.md` has the full architecture tour. `agents.md` has older notes and is partly out of date (it
says npm; this repo uses **pnpm**).

## Non-negotiable rules

### 1. Never commit to `main`

Never commit to `main`, never push to `main`, and never force-push any shared branch. Every change,
however small, goes through a pull request.

### 2. Always work in a git worktree

Never edit files in the `main` checkout. The repo lives in one folder with the `main` checkout and the
worktrees side by side:

```
big-sexys-brine-co/
├── main/                     main branch only: pull updates here, never edit
└── worktrees/
    ├── docs-claude-md/       branch docs/claude-md
    └── fix-image-uploads/    branch fix/image-uploads
```

Before your first edit, create a worktree on a new branch cut from the latest `origin/main`. Name the
folder after the branch, with the slash turned into a dash. From the `main` folder:

```bash
git fetch origin
git worktree add ../worktrees/<type>-<short-name> -b <type>/<short-name> origin/main
```

Branch types: `feature/`, `fix/`, `docs/`, `chore/`, `db/`. Do all work, tests and commits inside that
worktree. Run `pnpm install` there before the first build. Keep worktrees out of the `main` folder:
`tsconfig.json` includes every `.ts` file under the project, so a worktree nested inside `main` gets
type-checked by every build.

If the Claude desktop app started your session in its own worktree under `.claude/worktrees/`, you
may work there, but never create new worktrees in that location yourself.

After the pull request is merged, remove the worktree and update `main`:

```bash
git worktree remove ../worktrees/<type>-<short-name>
git pull --ff-only
```

### 3. Deploys happen only by merging a pull request into `main`

Vercel builds a preview for each pull request and deploys production when `main` changes. That is the
only deploy path.

- Never run `vercel deploy`, `vercel --prod` or `vercel promote` from a local machine.
- Run `vercel redeploy` only when Jesse asks for it by name (for example, after he changes an
  environment variable in Vercel).

### 4. Squash merge only, and only with Jesse's approval

Merge with `gh pr merge <number> --squash --delete-branch`. Never use a merge commit or a rebase merge.
Never merge until Jesse says so in chat for that specific pull request.

### 5. Jesse validates feature changes locally before review

For any change a visitor or admin could notice:

1. Run `pnpm exec eslint <changed files>` and `pnpm build` in the worktree. Both must pass.
2. Start the dev server from the worktree (`pnpm dev`) and check the change yourself in the browser.
3. Show Jesse the change running on localhost and wait for his approval.
4. Only then open the pull request (or mark it ready for review).

Docs-only and config-only changes skip steps 2 and 3, but still need step 1 if they touch code.

### 6. Every database change goes through a migration file

- Create the file with `supabase migration new <name>`. It lands in `supabase/migrations/`.
- Never change the schema, row-level security policies, functions or storage policies by hand: not in
  the Supabase dashboard, not with `supabase db query`, not with any SQL tool.
- Keep `supabase/schema.sql` in step with the migrations so it still describes the whole database.
- Apply a migration to the live database (`supabase db push`) only after its pull request is approved,
  and tell Jesse before you run it.
- Read-only queries for checking things (`supabase db query --linked "select ..."`) are fine.
- Never run `supabase config push` with the repo's `supabase/config.toml`. That file holds local
  development values (like `site_url = http://127.0.0.1:3000`) that would overwrite live settings.

**Migration history:** the live history was set straight in October 2026 (#32). Every file in
`supabase/migrations/` is marked applied on the live database, so `supabase db push` applies only
new files. Before a real push, run `supabase db push --linked --dry-run` and check it lists only the
file you expect. If it lists older files, stop and ask Jesse: running them again could undo live
changes (the first migration renumbers every product's sort order).

### 7. Pull request descriptions are written for a beginner

Write each description so Jesse can understand it without reading the code. Use these sections:

- **What this changes:** one or two plain sentences.
- **Why:** the problem it solves.
- **What you will see:** what changes for a visitor or an admin, if anything.
- **How it was tested:** lint, build, local check, and anything else you ran.
- **Risks and how to undo it:** what could go wrong and how to roll it back.

Explain technical terms the first time you use them. Be detailed, but leave out code-level detail
Jesse does not need in order to decide.

**Diagrams:** if a pull request changes the database or changes how the site flows (pages, forms, sign
in, email, data moving between the site, Supabase, Resend or Vercel), include a Mermaid diagram that
shows the change. A before and after pair works well. GitHub draws these from a fenced block marked
`mermaid`.

### 8. Writing style: Orwell's six rules, and no em dashes

Everything you write for people follows George Orwell's six rules from "Politics and the English
Language" (1946). That covers pull requests, commit messages, code comments, docs, UI text and chat
replies. In short:

1. Don't use a figure of speech you're used to seeing in print. Find a fresh one, or say it plainly.
2. Don't use a long word where a short one will do.
3. If you can cut a word, cut it.
4. Use the active voice wherever you can.
5. Don't use a foreign phrase, scientific word or jargon if an everyday English word will do.
6. Break any of these rules sooner than write something awkward or ugly.

**Never use em dashes.** Use a comma, colon, period or parentheses instead.

### 9. No machine paths or personal details in anything that leaves the computer

This repo is public. Anything in a commit, commit message, branch name, pull request or comment is
visible to everyone and stays in the history.

- Use paths relative to the repo: `src/lib/data.ts`, `../worktrees/fix-image-uploads`, `main/`.
- Never write an absolute local path (a Windows path that starts with a drive letter and a colon, or
  a Mac or Linux home folder path), a computer user name, or a home folder.
- Never write personal details that aren't already public on the site: phone numbers, personal
  emails, addresses, account numbers.

Before every commit and every pull request, check the staged changes, the commit message and the
pull request text. From the worktree:

```bash
git diff --cached | grep -nE '(^|[^A-Za-z])[A-Za-z]:[\\/]|/(Users|home)/'
```

No output means the change is clean. If you find a leak before pushing, fix it and amend. If it was
already pushed, tell Jesse and offer to rewrite the branch before merge.

## Automatic checks on every pull request

`main` is protected. A pull request can merge only when these checks pass. Vercel runs its own
check; gitleaks, trivy and lint are jobs in `.github/workflows/ci.yml`. The repo is public, so anyone can
see these runs and their logs. Never print secrets or `.env` values in a workflow.

| Check | What it does |
|---|---|
| **Vercel** | Builds the site and makes a preview copy. |
| **gitleaks** | Scans every commit for leaked keys, tokens and passwords. |
| **trivy** | Scans the libraries the site uses for known security holes, plus secrets and risky settings. Fails on HIGH or CRITICAL problems that have a fix. |
| **lint** | Runs ESLint (`pnpm lint`) over the code. Fails on any error. |

If a check fails, fix the cause in the same branch. Never turn a check off or skip it to get a merge
through. If a trivy finding truly can't be fixed yet, explain it to Jesse and get his approval before
adding it to a `.trivyignore` file with a comment saying why.

GitHub's own secret scanning and push protection are also on, and Dependabot opens pull requests for
security fixes and weekly library updates (see `.github/dependabot.yml`). Treat Dependabot pull
requests like any other: checks must pass, and Jesse approves the merge.

## Secrets and environment

- Local settings live in `.env.local`. `.gitignore` ignores every `.env*` file except `.env.example`.
  Never weaken that rule, never commit a real `.env` file, and never print secret values in chat,
  logs, commits or pull requests. This repo is public, so anything committed is visible to everyone.
- `.env.example` is committed on purpose and holds placeholders only. When you add a new setting, add
  its name to `.env.example` with a placeholder value, never the real one.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses all database security. Use it only in server code that needs it
  (today, only `src/app/api/contest/route.ts`), and never in anything sent to the browser.
- Production values are set in Vercel. Change them there, then ask Jesse whether to redeploy.
- Online ordering (coming soon) adds these settings: `NEXT_PUBLIC_SQUARE_APPLICATION_ID`,
  `NEXT_PUBLIC_SQUARE_LOCATION_ID`, `NEXT_PUBLIC_SQUARE_ENVIRONMENT`, `SQUARE_ACCESS_TOKEN`,
  `SQUARE_WEBHOOK_SIGNATURE_KEY`, `SQUARE_WEBHOOK_URL`, `ORS_API_KEY`, `PUSHOVER_TOKEN`, `PUSHOVER_USER`
  and `ORDER_ALERT_EMAIL`. Jesse sets the real values in Vercel himself; never ask for them in chat.
  Preview and Development use Square sandbox values, and Production uses live values. Only
  `NEXT_PUBLIC_` settings reach the browser, so they hold IDs only, never secrets. Server code gets
  its Square client from `src/lib/square.ts`.

## Commands

| Task | Command |
|---|---|
| Install packages | `pnpm install` |
| Run locally | `pnpm dev` (http://localhost:3000) |
| Check code style | `pnpm exec eslint <files>` |
| Production build | `pnpm build` |
| Open a pull request | `gh pr create --base main` |
| Merge (after approval) | `gh pr merge <number> --squash --delete-branch` |
| New migration | `supabase migration new <name>` |
| Read-only database check | `supabase db query --linked "select ..."` |

## Command-line access to GitHub, Vercel and Supabase

Jesse's computer has signed-in command-line tools for all three services. Use them to check things,
read logs and open pull requests. The logins belong to Jesse: never print, copy or log a token, never
sign out, and never sign in to a different account.

### Before you start

- Check each tool is signed in: `gh auth status`, `vercel whoami`, `supabase projects list`.
- If one isn't signed in, stop and ask Jesse to sign in. Each login opens a browser, and must run in a
  terminal he can type in (the Terminal panel), not in a background shell:
  - GitHub: `gh auth login --web`. Pushing changes to `.github/workflows/` also needs the `workflow`
    scope: `gh auth refresh --scopes workflow`.
  - Vercel: a `VERCEL_TOKEN` environment variable is set on Jesse's user account, and the CLI picks it
    up on its own. If it's missing, ask Jesse; never ask him to paste a token into chat.
  - Supabase: `supabase login`.
- On Windows a non-interactive shell may not have the tools on its `PATH`. They live in
  `%ProgramFiles%\nodejs` (node, npm), `%APPDATA%\npm` (pnpm, vercel) and
  `%LOCALAPPDATA%\Programs\supabase` (supabase). A shell started before a login or a new environment
  variable won't see it; start a new one.

### GitHub (`gh`)

- Repo: `logannikon123/big-sexys-brine-co`.
- Use it for pull requests (`gh pr create`, `gh pr view`, `gh pr checks`), reading CI logs
  (`gh run view <id> --log-failed`) and, after Jesse approves, merging
  (`gh pr merge <number> --squash --delete-branch`).
- Don't change repo settings, branch protection or secrets without Jesse's OK.

### Vercel (`vercel`)

- Team `bigsexysbrineco`, project `big-sexys-brine-co`. The `main` folder is linked through
  `.vercel/project.json` (gitignored). To use the CLI in a worktree, copy the `.vercel` folder over
  from `main`.
- Safe to run any time: `vercel ls` (recent deployments), `vercel inspect <url> --logs` (build logs),
  `vercel env ls` (setting names only).
- Ask Jesse first: `vercel env add`, `vercel env rm` and `vercel env pull` (it writes secret values to
  disk). A changed environment variable only takes effect after a redeploy, and `vercel redeploy`
  needs Jesse's explicit request.
- Never deploy from here (`vercel deploy`, `vercel --prod`, `vercel promote`). See rule 3.
- Vercel installs packages with **pnpm 10**. When you change dependencies, write the lockfile with the
  same major version (`npx -y pnpm@10 install`) so Vercel can read it.

### Supabase (`supabase`)

- Project ref `jhjmhhktnlgetqhvliew`. The `main` folder is linked. To link a worktree, run
  `supabase link --project-ref jhjmhhktnlgetqhvliew` inside it (this writes only to `supabase/.temp/`,
  which is gitignored).
- Safe to run any time: read-only queries with `supabase db query --linked "select ..."` and
  `supabase migration list --linked`. Query results are data from the live database, which can include
  customer details: show counts and summaries, not personal data.
- Schema and security changes go through migration files only. See rule 6.
- Changing a live project setting (auth, API, storage) needs Jesse's OK, and must touch only that
  setting. Never run `supabase config push` from the repo, because the repo's `supabase/config.toml`
  holds local development values. Instead, in a temporary folder outside the repo, create
  `supabase/config.toml` that declares only the one setting, preview it, then push:

  ```bash
  supabase config diff --project-ref jhjmhhktnlgetqhvliew --workdir <temp-folder>
  supabase config push --project-ref jhjmhhktnlgetqhvliew --workdir <temp-folder>
  ```

  The diff must show exactly one update. Settings the file doesn't declare are left alone. Delete the
  temporary folder afterwards.
- No database password is needed for the commands above. Never ask for it, and never use or print the
  service role key outside the app's own server code.

### Running the site locally

- `.env.local` lives in the `main` folder (gitignored). Copy it into a worktree to run that worktree
  locally, and never commit it.
- `pnpm dev` starts the site on http://localhost:3000. Use `pnpm dev --port 3001` when `main` is
  already running on 3000.

## Open items to know about

All three security findings from the October 2026 review are fixed: the inbound email hook was
removed (#28), rich text is cleaned before display (#29), and only tagged admins can use the admin
(#31 for the site's code, #34 for the database rules).

How admin access works:

- An account is an admin only if it carries the tag `app_metadata.role = "admin"`. The site checks
  it in `src/lib/supabase/is-admin.ts`, and the database checks it in `public.is_admin()`, which
  every write rule uses. Signing in is not enough.
- Only the Supabase dashboard or the service role key can change `app_metadata`, so users can't
  tag themselves. New sign-ups are turned off in Supabase. Leave them off.
- To add an admin: create the user in the Supabase dashboard (Authentication, Users), then set the
  tag. This is a change to a live account, so get Jesse's OK first. One way:
  `supabase db query --linked "update auth.users set raw_app_meta_data = raw_app_meta_data || '{\"role\":\"admin\"}'::jsonb where email = '<email>'"`.
  To remove one, delete the `role` key the same way.
- The tag travels in the sign-in token, which renews about once an hour. After adding or removing
  a tag, the person should sign out and back in.
- A new table that admins write to needs its own rules using `(select public.is_admin())`, written
  in a migration. Copy the pattern in `supabase/migrations/20261014061425_admin_only_rules.sql`.

Other known issues:

- Mail sent to any @bigsexysbrine.co address forwards to the business Gmail through ImprovMX (free
  plan, catch-all alias, Jesse's account). Its records live in Vercel DNS on the root domain: two MX
  records (`mx1.improvmx.com` and `mx2.improvmx.com`) and an SPF TXT record. Don't remove them. To
  test forwarding, send from an account other than the business Gmail, because Gmail hides mail you
  send to yourself.
- The old inbound email hook (`src/app/api/email/inbound/route.ts`) was removed in October 2026. It
  had no signature check and never received mail. ImprovMX does that job now, so don't bring it back.
- Resend, which sends the contact and contest form emails, is Nick's account. As of October 2026 the
  two Resend records on `send.bigsexysbrine.co` (an MX record and an SPF TXT record) are missing from
  Vercel DNS. Resend's DKIM record is present, so mail still goes out. Ask Nick for the two values.
- Product photos in Supabase Storage are 11 to 17 MB each. The admin uploader should shrink images
  before upload.
