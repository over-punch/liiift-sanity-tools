---
name: deploy
description: Deploy to Vercel by running cleanup first, then bumping the version and pushing via the Liiift deploy remote to trigger the deploy. Use when the user says "deploy", "ship it", or "push to production".
---

# Deploy to Vercel

Full deployment workflow: cleanup, then trigger Vercel deploy via version bump pushed through the Liiift remote.

## Setup

Each repo has two remotes:
- **origin** — QuiteQuinn account (for code pushes)
- **deploy** — Liiift account via SSH alias `github-liiift` (triggers Vercel)

If a repo is missing the `deploy` remote, add it:
```bash
git remote add deploy git@github-liiift:over-punch/<repo-name>.git
```

## Steps

### 1. Run Cleanup

Execute the full cleanup skill first:
- Update agent memory (if `.agent/` exists)
- Commit all pending changes
- Push to **origin** (QuiteQuinn)

### 2. Identify What to Deploy

Check which repos have changes that need deploying. Typically this is the backend (Next.js on Vercel), but confirm with the user if unclear.

### 3. Bump Version

For the repo being deployed:

1. Read `package.json` to find the current version
2. Bump the patch version (e.g., `1.0.4` → `1.0.5`)
3. Commit as the Liiift account with message: `v{new_version}`

```bash
git -c user.name="Liiift" -c user.email="hello@liiift.studio" commit -m "v{new_version}"
```

### 4. Push to Deploy Remote

Push to the `deploy` remote which authenticates as Liiift:

```bash
git push deploy main
```

This triggers the Vercel deployment hook. No account switching needed.

### 5. Sync Origin

Also push to origin so both remotes stay in sync:

```bash
git push origin main
```

### 6. Confirm

Report:
- What was committed in the cleanup step
- The new version number
- That the push to the deploy remote was successful
- Remind the user to check their Vercel dashboard for deployment status
