# Changelog

All notable changes to Pageflag are documented in this file. Format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Embeddable feedback widget: a single `<script>` tag adds a floating button
  that lets anyone click an element on the page and leave a comment, with an
  automatic viewport screenshot and no account required.
- Self-hosted team dashboard (sign up, projects/sites, pin list with filters
  by status/page URL/reporter, status changes).
- Per-project domain allow-list so a leaked embed snippet can't be used to
  capture screenshots of an unrelated site.
- One-click "create issue from pin" for GitHub Issues and Linear.
- Unlisted public review links so an external client can view a project's
  feedback without a Pageflag account.
- Docker Compose setup (Postgres + the app) and a GHCR-published Docker image
  on tagged releases.
- A real, re-recordable README demo (`docs/assets/demo.gif`/`demo.mp4`) and a
  `make demo` target (`scripts/record-demo/`) that captures the signup →
  install → pin → triage → resolve flow against the actual running app.

### Fixed

- Pin screenshot thumbnails no longer crop to blank whitespace on tall pages;
  the dashboard and public review page now show the full capture and link
  through to the original image.
- The "see it in Pageflag" link in issues filed via GitHub/Linear no longer
  404s - added the missing dashboard route, and corrected `.env.example`'s
  `DASHBOARD_ORIGIN` default to match `docker-compose.yml`.

[Unreleased]: https://github.com/Laaaaksh/pageflag/commits/main
