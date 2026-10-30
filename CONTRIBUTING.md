# Contributing to Taccuino 📒

Thanks for your interest! Taccuino is an open-source project (AGPL-3.0) and
every contribution is welcome.

## How to contribute

1. Fork the repo and create a descriptive branch (`feat/kanban-view`,
   `fix/block-split`, …)
2. Make your changes and test them manually in the browser (see below)
3. Make sure `bun run lint` passes with no errors
4. Open a Pull Request with a clear description of the problem/feature

## Ground rules

- **Respect the roadmap**: check `docs/` before proposing features outside of
  it. Out-of-scope features (advanced formulas, SSO, automations…) will be
  kindly declined.
- **Licenses**: before adding a dependency, verify it is MIT / Apache-2.0 /
  BSD / ISC / MPL-2.0. GPL or commercial packages are not allowed. Update
  `NOTICE.md` when you add one.
- **Privacy**: no telemetry, no mandatory network requests, no user data sent
  to third parties without explicit consent.
- **Legality**: never copy code, copy, icons or design from proprietary
  products (Notion in particular). Replicate *functionality*, never a
  product's identity.
- **User data**: never merge a change that could delete or corrupt content
  without version history and a way to restore it.
- **Language**: the UI is bilingual (Italian/English). Every visible string
  must be added to the dictionary in `src/lib/i18n.ts`.
- **Accessibility**: keyboard navigation, aria-labels, contrast.

## Development environment

```bash
bun install          # dependencies (or npm install)
bun run db:push      # apply the Prisma schema (SQLite)
bun run dev          # http://localhost:3000
bun run lint         # quality check
```

On first boot with an empty database, a few demo pages are seeded
automatically.

## Reporting bugs

Open an [issue](../../issues) and include:

- What you did and what you expected to happen
- What actually happened (screenshot or GIF if visual)
- OS, browser and how you're running Taccuino (dev / production build)

## Feature requests

Open an issue starting the title with `[idea]` and describe the problem you
are trying to solve, not just the solution. Local-first constraints come
first: anything that requires a third-party service by design will need a
very good argument.
