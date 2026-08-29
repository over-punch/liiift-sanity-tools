# Backup proxy

Keeps the GitHub token off the client. Required for any Studio whose dataset is not
strictly private, and recommended everywhere.

## Why it exists

In `direct` mode the Studio calls GitHub itself, which means the GitHub token lives in
the Studio's configuration. Sanity has no per-document access control, so anything in
the dataset is readable by everyone who can read the dataset — and if the dataset is
public, by anyone at all. Hiding the tool from viewers changes nothing: the token is
still readable, and a token that can dispatch workflows can do considerably more than
start a backup.

Proxy mode moves the token to a server you control.

## How it works

```
Status   Studio ──▶ proxy /runs?key=<target>    ──▶ GitHub Actions API (server-held token)
Trigger  Studio ──▶ proxy /trigger {key}        ──▶ workflow_dispatch
```

The Studio sends an **opaque key**, never an owner/repo. The proxy resolves that key
against `BACKUP_TARGETS`, so a Studio cannot ask it to touch a repository that is not
on the allowlist.

## Setup

Pick the adapter that matches your app.

**Pages Router, or any site without TypeScript configured** — use this one. It imports
the *compiled* core from the package, so it works in a plain JavaScript site with no
tsconfig and no typescript dependency (all three foundry sites are in this category).

```
cp proxy/nextjs-pages-router/backup-proxy.js \
   pages/api/backup-proxy/[...path].js
```

**App Router** — copy the whole `proxy/` directory into your app and put
`nextjs-app-router/route.ts` at `app/api/backup-proxy/[...path]/route.ts`. That adapter
imports `../core` relatively, so it needs the TypeScript source alongside it.

Then set the variables in `.env.example` and point the plugin at it with `proxyUrl` and
a matching `statusKey`.

`core.ts` is framework-agnostic — both Next.js files are thin adapters, and another
framework needs only an equivalent one. It is also published as
`@liiift-studio/sanity-backup-monitor/proxy` for importing directly.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/runs?key=<target>&limit=<n>` | Recent runs, `limit` capped at 20 |
| `POST` | `/trigger` body `{ key }` | Dispatch a run |

Both require the `x-backup-status-key` header when `BACKUP_STATUS_KEY` is set.

## Hardening

- Give the token **Actions: Read-only** unless you want the trigger button.
- Set `BACKUP_ALLOW_TRIGGER=false` to refuse `/trigger` regardless of token scope.
- Keep `BACKUP_TARGETS` as narrow as possible; it is the real security boundary.
