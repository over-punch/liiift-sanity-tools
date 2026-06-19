# Root README assets

Reproducible source for the diagrams embedded in the repo-root `README.md`.

## `ecosystem.svg`

Ecosystem overview of every plugin in the suite, grouped by family, with the
shared `test-studio` dev harness. Authored as Mermaid (`ecosystem.mmd`) so it is
text, diffable, and regenerable.

Regenerate after editing `ecosystem.mmd`:

```bash
cd assets
npx --yes @mermaid-js/mermaid-cli -i ecosystem.mmd -o ecosystem.svg -b transparent
```

When you regenerate, bump the `?v=N` cache-buster on the `<img>` URL in the root
`README.md` so GitHub and npm re-fetch the image.
