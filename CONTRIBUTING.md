# Contributing to Pageflag

Thank you for your interest in contributing. Pageflag is a self-hosted visual
feedback and bug-reporting tool, open source under the MIT license.

## Getting started

```bash
git clone https://github.com/<your-username>/pageflag.git   # your fork, see below
cd pageflag
npm install
make test-db   # starts a throwaway Postgres container for the test suite
npm run migrate --workspace server
```

Then, in separate terminals:

```bash
cp .env.example server/.env   # fill in DATABASE_URL / JWT_SECRET, see .env.example
make dev-server       # API on :4000
make dev-dashboard    # dashboard on :5173
npm run dev --workspace packages/widget   # rebuilds dist/widget.js and dist/pin-editor.js on change
```

Open the dashboard at http://localhost:5173, create an account and a project,
then paste the install snippet it shows you into any local HTML file and open
it in a browser to exercise the full widget flow end to end.

## Requirements

- Node.js 22+
- Docker (for the local Postgres test/dev database)

## Repository layout

- `server/` - Express + Postgres API and, in production, the single process
  that serves the built dashboard and widget bundles too (see `server/src/app.ts`).
- `dashboard/` - the React/Vite team dashboard (projects, pins, integrations, settings).
- `packages/widget/` - the embeddable `<script>` snippet (`loader.ts`, tiny, no
  dependencies) and the lazy-loaded click-to-pin composer (`pin-editor.ts`,
  bundles `html2canvas`).
- `docs/AGENTS.md` (if present) and this file cover project-specific knowledge;
  everything else should be discoverable from the code.

## Contribution workflow

The `main` branch is protected: every change lands through a pull request,
required status checks must pass, and protection is enforced for everyone -
including the maintainer. There are no direct pushes to `main`.

1. Fork the repo on GitHub, then clone your fork (command above).
2. Create a descriptively named feature branch from `main`.
3. Make your changes as small, focused commits, each leaving the tree buildable.
4. Run `make lint` and `make test` - both must pass.
5. If your change is user-facing (a feature, fix, or behavior change), add one
   bullet under the `Unreleased` heading in [CHANGELOG.md](CHANGELOG.md).
6. Push the branch to your fork.
7. Open a pull request against `main` here.

A PR can merge only when the `Test` and `Lint` checks pass and all conversation
threads are resolved.

## Testing

`make test` starts a throwaway Postgres container (`pageflag-test-db`, port
`55444`) if one isn't already running, then runs every workspace's suite:

- `packages/widget` - Vitest + jsdom, covering the pure DOM/geometry helpers
  (`cssSelector`, percent/pixel conversion, script-tag config parsing, the
  reporter-identity localStorage round-trip).
- `dashboard` - Vitest, covering the API client's error handling and request
  shaping against a mocked `fetch`.
- `server` - Vitest + Supertest against a real Postgres database (migrated
  fresh via `test/globalSetup.ts`), covering auth, the public pin-submission
  and domain allow-list, dashboard pin filtering/status changes, the
  GitHub/Linear issue-creation integrations (with `fetch` mocked), and the
  public review-link endpoints.

Server test files share one database and truncate between tests
(`test/helpers.ts#resetDb`), so `server/vitest.config.ts` runs them without
file-level parallelism - keep that in mind if you add a new server test file.

## Code style

- Formatting is enforced by Prettier (`make format` / `npx prettier --write .`); CI checks it.
- Linting is enforced by ESLint's flat config (`eslint.config.js`); `make lint` runs it across every workspace.
- Prefer `async function` route handlers wrapped in `asyncHandler` (`server/src/lib/asyncHandler.ts`) over `.then()` chains - Express 4 does not forward a rejected promise to error middleware on its own.
- The widget (`packages/widget/src`) must stay framework-agnostic vanilla TypeScript with zero runtime dependencies in `loader.ts` specifically - it's the file customers paste onto their own sites, and its whole pitch is a tiny footprint. Anything heavier (like `html2canvas`) belongs in `pin-editor.ts`, which loads lazily.

## Releases

Releases are cut by pushing a tag; GitHub Actions does the rest
(`.github/workflows/release.yml`):

1. Make sure every user-facing change since the last release has a bullet
   under `Unreleased` in [CHANGELOG.md](CHANGELOG.md).
2. Give the release its own changelog section: insert `## [x.y.z] - YYYY-MM-DD`
   above the (now empty) `## [Unreleased]` heading, following the format of
   the existing sections, and update the compare links at the bottom of the
   file - add `[x.y.z]: https://github.com/Laaaaksh/pageflag/compare/v<prev>...vx.y.z`
   and repoint `[Unreleased]` at `compare/vx.y.z...HEAD`.
3. Land those changelog edits on `main` through a pull request, then tag and push:

   ```bash
   git tag vx.y.z && git push origin vx.y.z
   ```

The workflow extracts the tagged version's CHANGELOG section as the release
notes (`scripts/release-notes.sh` fails the release rather than publishing
empty notes if that section is missing), builds the Docker image, pushes it to
`ghcr.io/laaaaksh/pageflag` tagged both `vx.y.z` and `latest`, and publishes
the GitHub release.

## Reporting issues

Please open a GitHub issue before starting large changes or proposing new
features, so scope and approach can be settled before code is written. Bug
reports should include the Pageflag version, your deployment method, steps to
reproduce, and what you expected vs. what happened.
