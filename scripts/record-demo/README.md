# record-demo

Records the README demo (`docs/assets/demo.mp4` / `demo.gif`) by driving the
real, running app with Playwright - signup, create a project, install the
widget on the bundled `fixtures/host.html` page, drop a pin on a real element,
watch it arrive in the dashboard with its screenshot, triage it to "in
progress", then resolve it. This package is dev-only tooling; it is not a
dependency of the product build.

## One-shot

```bash
make demo   # from the repo root: boots docker compose, records, converts
```

## Manual run

1. Get the real stack running and reachable, either:
   - `docker compose up -d --build` (the documented install path - dashboard
     and API both on `:4000`), or
   - `make dev-server` + `make dev-dashboard` in separate terminals (server on
     `:4000`, dashboard dev server on `:5173` - see CONTRIBUTING.md).
2. Install and record:
   ```bash
   cd scripts/record-demo
   npm install
   npx playwright install chromium
   npm run record   # DASHBOARD_URL=http://localhost:5173 npm run record, for the dev-server setup
   ```
   This writes `scripts/record-demo/output/demo.webm`.
3. Convert to the assets the README embeds:
   ```bash
   cd ../..
   ffmpeg -y -i scripts/record-demo/output/demo.webm -vf "scale=1280:-2" \
     -c:v libx264 -pix_fmt yuv420p -movflags +faststart -crf 20 docs/assets/demo.mp4
   ffmpeg -y -i scripts/record-demo/output/demo.webm \
     -vf "fps=12,scale=960:-2:flags=lanczos,palettegen" /tmp/palette.png
   ffmpeg -y -i scripts/record-demo/output/demo.webm -i /tmp/palette.png \
     -filter_complex "fps=12,scale=960:-2:flags=lanczos[x];[x][1:v]paletteuse" docs/assets/demo.gif
   ```
4. Sanity-check the result before committing:
   ```bash
   ffprobe -v error -show_entries format=duration -show_entries stream=width,height,r_frame_rate,nb_frames \
     -of default=noprint_wrappers=1 docs/assets/demo.gif
   ```
   Confirm it's not a handful of frames, the dimensions are 960-wide, and the
   file is under 10MB (drop the `fps=12` in the palette/paletteuse filters or
   shorten the walkthrough in `record.mjs` if it isn't).

## Notes

- `fixtures/host.html` is a static marketing-site fixture. It reads `?key=` and
  `?api=` from its own URL and inserts the widget `<script>` tag at runtime
  with those values - `record.mjs` fills them in with the public key and API
  origin it reads straight off the dashboard's own Install tab, so the
  fixture always installs the snippet the product actually generated that
  run, not a hardcoded one.
- `DASHBOARD_URL` (default `http://localhost:4000`) is the only required
  override for the split dev-server setup; the widget's API origin is parsed
  from the rendered Install-tab snippet, not from a separate env var.
- `HOST_PORT` (default `5057`) picks the port the fixture page is served on.
- Re-running against a freshly started stack replays the same walkthrough
  (same steps, timings, and UI states); the demo account's email is
  timestamped so repeat runs against a non-reset database don't collide on a
  duplicate signup.
