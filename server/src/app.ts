import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { pinsByProjectRouter, pinRouter } from "./routes/pins.js";
import { integrationsRouter } from "./routes/integrations.js";
import { publicRouter } from "./routes/public.js";
import { reviewRouter } from "./routes/review.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src (dev, via tsx) and server/dist (built) sit at the same depth under the
// repo root, so this relative path resolves correctly either way.
const repoRoot = path.join(__dirname, "..", "..");
const widgetDist = path.join(repoRoot, "packages", "widget", "dist");
const dashboardDist = path.join(repoRoot, "dashboard", "dist");

const dashboardCors = cors({ origin: env.DASHBOARD_ORIGIN, credentials: true });

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(cookieParser());
  app.use(express.json({ limit: "6mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", dashboardCors, authRouter);
  app.use("/api/projects/:projectId/pins", dashboardCors, pinsByProjectRouter);
  app.use("/api/projects/:projectId/integrations", dashboardCors, integrationsRouter);
  app.use("/api/projects", dashboardCors, projectsRouter);
  app.use("/api/pins", dashboardCors, pinRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/review", cors(), reviewRouter);

  // The embeddable widget bundle - served from every deploy (dev included), since it's
  // what customers point their <script> tag at from a third-party origin. `pin-editor.js`
  // is loaded via a cross-origin dynamic `import()`, which browsers fetch in CORS mode,
  // so this needs permissive CORS headers just like the public API does.
  if (existsSync(widgetDist)) {
    app.use(cors(), express.static(widgetDist, { maxAge: "1h" }));
  }

  // The built dashboard SPA. In dev the dashboard runs on its own Vite server instead
  // (see DASHBOARD_ORIGIN); this only activates once `dashboard/dist` exists, i.e. in a
  // production image where the server is the single container serving everything.
  if (existsSync(dashboardDist)) {
    app.use(express.static(dashboardDist));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(dashboardDist, "index.html"));
    });
  }

  app.use(
    (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error(err);
      res.status(500).json({ error: "internal server error" });
    },
  );

  return app;
}
