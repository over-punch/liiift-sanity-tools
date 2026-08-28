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

1. Copy this whole `proxy/` directory into your app.
2. Put `nextjs-app-router/route.ts` at `app/api/backup-proxy/[...path]/route.ts`.
3. Set the variables in `.env.example`.
4. Point the plugin at it with `proxyUrl` and a matching `statusKey`.

`core.ts` is framework-agnostic — the Next.js file is a thin adapter, and another
framework needs only an equivalent one.

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
