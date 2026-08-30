import { chromium } from "@playwright/test";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DASHBOARD_URL is the dashboard's own origin. On the documented docker-compose
// deploy it's the same :4000 origin as the API. In local dev (make dev-server +
// make dev-dashboard) the dashboard runs on :5173 instead - override it then.
const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:4000";
const HOST_PORT = Number(process.env.HOST_PORT || 5057);
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, "output");
const FIXTURES_DIR = path.join(__dirname, "fixtures");
const HEADLESS = process.env.HEADFUL !== "1";

const DEMO_USER = {
  name: "Priya Nair",
  teamName: "Acme Marketing",
  email: `demo-${Date.now()}@pageflag.dev`,
  password: "demo-pass-1234",
};

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
};

function startFixtureServer(dir, port) {
  const server = http.createServer((req, res) => {
    const reqPath = decodeURIComponent(req.url.split("?")[0]);
    const filePath = path.join(dir, reqPath === "/" ? "/host.html" : reqPath);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(filePath)] ?? "application/octet-stream",
      });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, () => resolve(server));
  });
}

async function run() {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const fixtureServer = await startFixtureServer(FIXTURES_DIR, HOST_PORT);
  console.log(`[record-demo] fixture host page on http://localhost:${HOST_PORT}`);

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    recordVideo: { dir: OUTPUT_DIR, size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();
  const pause = (ms) => page.waitForTimeout(ms);

  try {
    // 1. Create a real account through the dashboard's own signup form.
    await page.goto(`${DASHBOARD_URL}/signup`);
    await page.waitForSelector('h1:has-text("Create your account")');
    await pause(2000);
    await page.getByLabel("Your name").fill(DEMO_USER.name);
    await page.getByLabel("Team name").fill(DEMO_USER.teamName);
    await page.getByLabel("Email").fill(DEMO_USER.email);
    await page.getByLabel("Password").fill(DEMO_USER.password);
    await pause(1000);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForSelector('h1:has-text("Your sites")');
    await pause(2000);

    // 2. Create a project ("site") for the demo host page.
    await page.getByPlaceholder("e.g. Marketing site").fill("Acme Marketing Site");
    await pause(800);
    await page.getByRole("button", { name: "New site" }).click();
    await page.waitForSelector(".project-card");
    await pause(2000);
    await page.getByText("Acme Marketing Site").click();
    await page.waitForSelector('h1:has-text("Acme Marketing Site")');
    const projectUrl = page.url();
    await pause(1500);

    // 3. Open the Install tab and read the *real* snippet the product renders -
    // same public key and API origin a real customer would copy-paste.
    await page.getByRole("button", { name: "Install" }).click();
    await page.waitForSelector(".snippet");
    await pause(5000);
    const snippet = await page.locator(".snippet").innerText();
    const keyMatch = snippet.match(/data-project="([^"]+)"/);
    const srcMatch = snippet.match(/src="([^"]+)"/);
    if (!keyMatch || !srcMatch) throw new Error(`could not parse install snippet: ${snippet}`);
    const publicKey = keyMatch[1];
    const apiOrigin = new URL(srcMatch[1]).origin;

    // 4. Load the bundled demo host page with that snippet "installed".
    const hostUrl = `http://localhost:${HOST_PORT}/host.html?key=${encodeURIComponent(publicKey)}&api=${encodeURIComponent(apiOrigin)}`;
    await page.goto(hostUrl);
    await page.waitForSelector(".pf-button", { timeout: 10_000 });
    await pause(3000);

    // 5. Arm the widget and click a real element on the page to place a pin.
    await page.click(".pf-button");
    await pause(1000);
    await page.click("#hero-cta");
    await page.waitForSelector(".pf-popover textarea", { timeout: 10_000 });
    await pause(1000);

    await page
      .locator(".pf-popover textarea")
      .pressSequentially(
        "The CTA button color clashes with our new brand purple - can we fix before launch?",
        {
          delay: 25,
        },
      );
    await pause(2000);
    await page.fill(".pf-popover .pf-name", "Priya (Design)");
    await pause(600);
    await page.fill(".pf-popover .pf-email", "priya@acme.test");
    await pause(1200);
    await page.click(".pf-popover button.pf-submit");

    let screenshotCaptured = true;
    try {
      await page.waitForSelector(".pf-marker", { timeout: 15_000 });
    } catch {
      screenshotCaptured = false;
      console.warn("[record-demo] pin marker never appeared after submit");
    }
    await pause(4000);

    // 6. Switch to the dashboard and show the pin arriving with its screenshot.
    await page.goto(projectUrl);
    await page.waitForSelector(".pin-card", { timeout: 10_000 });
    try {
      await page.waitForSelector(".pin-card img.pin-screenshot", { timeout: 8_000 });
    } catch {
      screenshotCaptured = false;
      console.warn("[record-demo] pin screenshot image never rendered in the dashboard");
    }
    await pause(5500);

    // 7. Triage it (open -> in progress) ...
    await page.selectOption(".pin-card select", "in_progress");
    await pause(3000);

    // 8. ... then resolve it.
    await page.selectOption(".pin-card select", "resolved");
    await pause(3000);

    // 9. Back on the host page, the resolved pin's marker is gone: the public
    // pin-listing endpoint only ever returns non-resolved pins to visitors.
    await page.goto(hostUrl);
    await pause(5000);

    if (!screenshotCaptured) {
      console.warn(
        "[record-demo] working: pin screenshot capture did not complete end to end in this run",
      );
    }
  } finally {
    await page.close();
    await context.close();
    await browser.close();
    await new Promise((resolve) => fixtureServer.close(resolve));
  }

  const video = fs.readdirSync(OUTPUT_DIR).find((f) => f.endsWith(".webm"));
  if (!video) throw new Error("no video file was produced");
  const dest = path.join(OUTPUT_DIR, "demo.webm");
  fs.renameSync(path.join(OUTPUT_DIR, video), dest);
  console.log(`[record-demo] recorded ${dest}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
