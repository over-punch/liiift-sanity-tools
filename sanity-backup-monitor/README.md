# @liiift-studio/sanity-backup-monitor

Studio panel showing whether your scheduled dataset backups are actually running.

## Why

A backup's failure mode is silence. TDF's backup workflow existed, appeared in the
Actions tab, and had not succeeded in three months — nobody noticed, because nothing
surfaced the gap anywhere people look. This panel puts backup age in the Studio, where
editors already are, and colours the card when a backup is overdue or failing.

## Install

```bash
npm i @liiift-studio/sanity-backup-monitor
```

```ts
// sanity.config.ts
import { backupMonitor } from '@liiift-studio/sanity-backup-monitor'

export default defineConfig({
  plugins: [
    backupMonitor({
      token: process.env.SANITY_STUDIO_BACKUP_GH_TOKEN,
      targets: [
        {
          label: 'MCKL',
          owner: 'Liiift-Studio',
          repo: 'mckl-cms',
          workflow: 'backup-routine.yml',
          expectedIntervalDays: 7,
        },
      ],
    }),
  ],
})
```

## Options

| Option | Purpose |
| --- | --- |
| `targets` | Repositories to watch (see below) |
| `token` | GitHub token — see Token scope |
| `runLimit` | Runs listed per target (default 5) |
| `allowTrigger` | Show the "Back up now" button (default **false**) |
| `refreshIntervalMs` | Poll interval (default 5 min; `0` disables) |
| `name` / `title` / `icon` | Studio tool identity |

Each target takes `label`, `owner`, `repo`, `workflow`, and optionally `ref`
(default `main`) and `expectedIntervalDays` (default 7).

## Health

`expectedIntervalDays` drives the panel. The badge distinguishes *late* from *broken*,
because those need different responses:

| Badge | Meaning |
| --- | --- |
| **Healthy** | Last success within 1.25x the interval, nothing failing since |
| **Overdue** | Past 1.25x the interval |
| **Stale** | Past 2x the interval |
| **Errors** | Recent success, but runs have failed since |
| **Failing** | No success in the fetched runs |
| **No runs** | Nothing found — usually a wrong `workflow` filename |
| **Unknown** | Runs still in flight, or a timestamp that could not be read |

The 25% grace exists because GitHub delays scheduled runs by minutes or hours, never
days. On a weekly cadence that surfaces a problem at 8.75 days rather than sitting quiet
for a fortnight.

GitHub's `neutral` counts as a success; `skipped`, `cancelled` and `action_required` are
treated as neither success nor failure, so routine path-filter and concurrency events do
not downgrade a healthy target.

`assessHealth` is exported. Its signature is
`assessHealth(runs, expectedIntervalDays?, now?)` — pass `now` to make it deterministic.

## Disabled workflows

GitHub disables scheduled workflows after **60 days of repository inactivity**, and they
can be disabled by hand. Either way the file still exists and the Actions tab still lists
it — the only symptom is that runs quietly stop, which a run list alone cannot tell apart
from an idle repo. The panel reads the workflow's own `state` and shows a prominent alert
when it is not `active`. This is the failure mode the tool exists for, so it is worth the
extra request. (Direct mode only.)

## Token scope

The token is compiled into the Studio bundle. On a hosted Studio that bundle sits behind
login, so it is not public — but it **is** readable via devtools by anyone who can open
the Studio, including Viewers. Restricting the tool to editors does not change that.

Use a **fine-grained token scoped to `Actions: Read-only` on a single repository**. Then
what a Studio user could extract reaches nothing they cannot already read from the
dataset. Do not use one token across several repositories: that turns a Viewer on one
project into a reader of another project's backups.

**Triggering is off by default.** `allowTrigger: true` shows the "Back up now" button,
which calls `workflow_dispatch` and needs `Actions: read and write`. A write-scoped token
extractable from the bundle can dispatch workflows on that repo, which is a genuinely
larger risk than reading run history — so the panel shows a warning when that combination
is active, and a server-side proxy is the right answer if you want it in production.

A proxy implementation lives in `proxy/` in this repo but is **not published** and has
not been hardened; see that directory's README before relying on it.

## Restoring — rehearsed 2026-08-31

The restore path below was executed end to end against Darden, into a throwaway
dataset, and the throwaway deleted afterwards. `production` was never touched.

```bash
# 1. Download the artifact from the repo's Actions run, then:
npx sanity@latest dataset create restore-check --project-id <id> --visibility private
npx sanity@latest dataset import <backup>.tar.gz \
  --dataset restore-check --project-id <id> \
  --replace --allow-assets-in-different-dataset

# 2. Verify the counts, then clean up
npx sanity@latest dataset delete restore-check --project-id <id>
```

Use `--dataset`, not a positional argument — the CLI deprecated the positional form.

**What it proved.** A 1.77 MB / 6,239-document backup imported in **1m 28s**, of which
1m 11s was asset-document validation. Every count matched: 1,125 orders, 457 fonts,
10 typefaces, 4,153 asset records. The tarball itself had no parse errors, no duplicate
IDs, no missing `_id`/`_type`, and reconciled exactly against live — production's 6,707
documents minus 13 `system.*` docs minus 455 created after the backup ran equals 6,239.

**What it also proved, and this is the limitation.** Asset URLs in the restored dataset
still read `.../files/<project>/production/...` — they point at the *source* dataset, not
the restored one. They returned HTTP 200 only because `production` still existed. Restore
into a project whose original dataset is gone and every asset reference is a 404. The
documents, relationships and asset *metadata* all survive; the binaries do not. That is
what the asset mirror is for.

A note on the source data rather than the backup: Darden's dataset carries ~2,497
references to documents that no longer exist. The backup reproduces them faithfully —
they are dangling in production too.

## Testing

```bash
npm test
npm run typecheck
```
