# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

## Architecture

Three npm workspaces: `server/` (Express + Postgres API; also serves the
built dashboard and widget bundles - see `server/src/app.ts`), `dashboard/`
(React/Vite team UI), `packages/widget/` (the embeddable snippet). See
`CONTRIBUTING.md` for the dev workflow and each workspace's role.

- `packages/widget` builds **two separate bundles** (`esbuild.config.js`):
  `dist/widget.js` (the tiny snippet customers paste, no dependencies) and
  `dist/pin-editor.js` (lazy-loaded via a dynamic `import()` only when someone
  opens the composer, bundles `html2canvas`). Keep new widget features out of
  `loader.ts` unless they're needed on every page load - that file's size is
  the whole pitch.
- Both widget bundles are fetched cross-origin from whatever site embeds them,
  including `pin-editor.js` via a dynamic `import()`, which browsers fetch in
  CORS mode. `server/src/app.ts` wraps the widget static route in `cors()` for
  exactly this reason - don't remove it or the composer will silently fail to
  load off-domain.
- `dashboard`'s API origin (`VITE_API_BASE`) is baked in at **build time**, not
  read at runtime - it has to be, since the install snippet it renders is
  pasted onto a different site than the dashboard itself. Changing the public
  origin of a deployment means rebuilding the dashboard/Docker image, not just
  changing an env var post-deploy (`Dockerfile`'s `ARG VITE_API_BASE`).

## Testing

- Server tests hit a real Postgres on port **55444** (`server/test/testEnv.ts`,
  `make test-db`, and the `postgres` service in `.github/workflows/ci.yml` all
  share this port). It's a deliberately unusual port, not 5432/55432/55433,
  because sibling projects in this same portfolio run their own throwaway test
  Postgres containers on nearby ports during local development - check
  `docker ps` before assuming a `port already allocated` error means this
  project's own container is already up.
- `server/vitest.config.ts` sets `fileParallelism: false`: every server test
  file shares one database and truncates between tests
  (`test/helpers.ts#resetDb`), so new test files must not run concurrently
  with existing ones.
- `packages/widget` needs `--no-experimental-webstorage` passed to the worker
  process (see its `vitest.config.ts`, which also sets `environment: "jsdom"`
  project-wide) - Node 22+'s own built-in `localStorage` global otherwise
  shadows jsdom's real one and every `window.localStorage` call in a test
  silently no-ops. `dashboard` (`vite.config.ts`) defaults to
  `environment: "node"` instead and opts individual files into jsdom with a
  `// @vitest-environment jsdom` comment (see `dashboard/test/routing.test.tsx`)
  - add the same `--no-experimental-webstorage` guard there too if a
  jsdom-mode dashboard test ever touches `localStorage`.

## Known build issue

As of 2026-08-30, `docker compose up -d --build` (and any fresh `npm ci` at
the repo root) fails during the dashboard build: `@vitejs/plugin-react` was
bumped to `^6.1.0` (needs `vite ^8`) while `vite` is still pinned `^6.0.11`
(package-lock resolves `6.4.3`) - `vite.config.ts` fails to load with
`ERR_PACKAGE_PATH_NOT_EXPORTED` on `vite/internal`. This is a dependency-bump
regression, not caught by CI (see below). A worktree with node_modules
installed *before* that bump (pre-existing, un-reinstalled) is unaffected -
`make dev-server` + `make dev-dashboard` (see CONTRIBUTING.md) still works
end to end; only a fresh install (Docker's `npm ci`, or `npm install` in an
existing worktree) reproduces the break. Fix by aligning `@vitejs/plugin-react`
and `vite` majors in `dashboard/package.json`.

## Release

`ghcr.io/laaaaksh/pageflag` image names must be lowercase; `.github/workflows/release.yml`
lowercases `github.repository` itself before tagging, since the GitHub owner
(`Laaaaksh`) isn't. See `CONTRIBUTING.md` for the full tag-and-release procedure.

No tag has ever been pushed, so the GHCR image and GitHub release the README
and SECURITY.md describe don't exist yet - both docs say so explicitly until
a first tag lands. `ci.yml` already triggers on `main` (this repo's real
default branch), so pushing a tag is the only remaining step, but as of
2026-08-30 every Actions run on this repo (CI included) fails immediately
with a GitHub account billing/spending-limit error, not a code or workflow
problem - that must clear before a tag push can actually publish anything.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
