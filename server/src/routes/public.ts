import { Router, type Response } from "express";
import cors from "cors";
import { z } from "zod";
import { query } from "../db.js";
import { isOriginAllowed } from "../lib/domains.js";
import { saveScreenshot, readScreenshot } from "../lib/screenshots.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import type { Pin, Project } from "../types.js";

export const publicRouter = Router();
publicRouter.use(cors());

async function loadProjectByPublicKey(publicKey: string): Promise<Project | null> {
  const { rows } = await query<Project>("SELECT * FROM projects WHERE public_key = $1", [
    publicKey,
  ]);
  return rows[0] ?? null;
}

function checkOrigin(req: { headers: { origin?: string } }, project: Project): boolean {
  return isOriginAllowed(req.headers.origin, project.allowed_domains);
}

const listQuerySchema = z.object({ pageUrl: z.string().min(1) });

/** Open/in-progress pins for a page, so the widget can render markers for previously-filed feedback. */
publicRouter.get(
  "/:publicKey/pins",
  asyncHandler(async (req, res) => {
    const project = await loadProjectByPublicKey(req.params.publicKey);
    if (!project) {
      res.status(404).json({ error: "unknown project" });
      return;
    }
    if (!checkOrigin(req, project)) {
      res.status(403).json({ error: "origin not allowed for this project" });
      return;
    }
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "pageUrl is required" });
      return;
    }

    const { rows } = await query<Pin>(
      `SELECT id, x, y, comment, status, created_at FROM pins
      WHERE project_id = $1 AND page_url = $2 AND status <> 'resolved'
      ORDER BY created_at ASC`,
      [project.id, parsed.data.pageUrl],
    );
    res.json({ pins: rows });
  }),
);

const createPinSchema = z.object({
  pageUrl: z.string().min(1),
  selector: z.string().max(2000).optional(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  viewportWidth: z.number().int().positive(),
  viewportHeight: z.number().int().positive(),
  userAgent: z.string().max(500).optional(),
  screenshot: z.string().optional(),
  comment: z.string().min(1).max(5000),
  reporterName: z.string().max(200).optional(),
  reporterEmail: z.string().email().max(320).optional().or(z.literal("")),
});

publicRouter.post(
  "/:publicKey/pins",
  asyncHandler(async (req, res) => {
    const project = await loadProjectByPublicKey(req.params.publicKey);
    if (!project) {
      res.status(404).json({ error: "unknown project" });
      return;
    }
    if (!checkOrigin(req, project)) {
      res.status(403).json({ error: "origin not allowed for this project" });
      return;
    }
    const parsed = createPinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid input" });
      return;
    }
    const data = parsed.data;

    let screenshotPath: string | null = null;
    if (data.screenshot) {
      try {
        screenshotPath = await saveScreenshot(data.screenshot);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
    }

    const { rows } = await query<Pin>(
      `INSERT INTO pins (
       project_id, page_url, selector, x, y, viewport_width, viewport_height,
       user_agent, screenshot_path, comment, reporter_name, reporter_email
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
      [
        project.id,
        data.pageUrl,
        data.selector ?? null,
        data.x,
        data.y,
        data.viewportWidth,
        data.viewportHeight,
        data.userAgent ?? null,
        screenshotPath,
        data.comment,
        data.reporterName ?? null,
        data.reporterEmail || null,
      ],
    );
    res.status(201).json({ pin: rows[0] });
  }),
);

publicRouter.get(
  "/:publicKey/pins/:pinId/screenshot",
  asyncHandler(async (req, res) => {
    const project = await loadProjectByPublicKey(req.params.publicKey);
    if (!project || !checkOrigin(req, project)) {
      res.status(404).end();
      return;
    }
    await sendPinScreenshot(res, project.id, req.params.pinId);
  }),
);

async function sendPinScreenshot(res: Response, projectId: string, pinId: string): Promise<void> {
  const { rows } = await query<Pin>(
    "SELECT screenshot_path FROM pins WHERE id = $1 AND project_id = $2",
    [pinId, projectId],
  );
  const path = rows[0]?.screenshot_path;
  if (!path) {
    res.status(404).end();
    return;
  }
  try {
    const buffer = await readScreenshot(path);
    res.setHeader("Content-Type", path.endsWith(".png") ? "image/png" : "image/jpeg");
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.send(buffer);
  } catch {
    res.status(404).end();
  }
}
