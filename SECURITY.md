# Security Policy

## Supported versions

Pageflag is a young project. Security fixes are made against the **latest
release** and `main` only.

| Version        | Supported |
| -------------- | --------- |
| latest release | yes       |
| older releases | no        |

## Reporting a vulnerability

Please do **not** open a public GitHub issue for anything you believe is a
security problem.

Use GitHub's private vulnerability reporting instead:

> https://github.com/Laaaaksh/pageflag/security/advisories/new

That link reaches the maintainer privately - the report, follow-up discussion,
and any fix coordination stay confidential until a patched release ships.

When reporting, please include the Pageflag version or image tag you're
running, your deployment method (Docker Compose vs. bare `npm`), and clear
steps to reproduce.

## What belongs in a report

Pageflag runs an embeddable script on pages you may not fully control, and
stores screenshots and issue-tracker credentials on behalf of self-hosters.
Things worth reporting:

- **Domain allow-list bypass.** A way for the public pin-submission endpoint
  (`/api/public/:publicKey/pins`) to accept a request from an origin a
  project's `allowed_domains` list does not permit - this is the mechanism
  that stops a leaked embed snippet from being used to capture screenshots of
  an unrelated site.
- **Review-token or public-key guessing.** Both are meant to be
  unguessable bearer secrets (see `server/src/lib/keys.ts`); a way to
  enumerate or predict them is in scope.
- **Screenshot path traversal.** Any way to make `GET /api/pins/:id/screenshot`
  (or its public/review-token equivalents) read a file outside the configured
  `SCREENSHOT_DIR`.
- **Auth/session issues.** Session-cookie forgery, a way to access another
  team's projects or pins, or a way to bypass `requireProjectAccess`/
  `requirePinAccess`.
- **Stored XSS via pin content.** The dashboard renders reporter-supplied
  comments, names, and page URLs; a way to get unescaped HTML/script
  execution from those fields is in scope.

## Out of scope

- The GitHub personal access token and Linear API key a project owner
  configures for issue-tracker integrations are stored in the database as
  connection config, not separately encrypted. Anyone with direct database
  access already has that trust level in a self-hosted deployment - this is a
  documented trust boundary, not a vulnerability to report.
- Third-party issues in `html2canvas`'s screenshot capture (e.g. it cannot
  faithfully render every CSS feature) - please report those upstream unless
  you've found a way to turn it into a security issue specific to Pageflag.

## Credits

Reporters who wish to be credited in a fix's release notes may say so in the
private report; otherwise reports are handled without attribution.
