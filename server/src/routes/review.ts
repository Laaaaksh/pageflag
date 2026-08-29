import { Router } from "express";
import { query } from "../db.js";
import { readScreenshot } from "../lib/screenshots.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import type { Pin, Project } from "../types.js";

/**
 * Unlisted, unauthenticated read access for a project's pins via its `review_token` -
 * lets an external client review feedback without a Pageflag account. Token is treated
 * as a bearer secret: knowing it grants read access, so it must never be guessable
 * (see lib/keys.ts) or logged.
 */
export const reviewRouter = Router();

async function loadProjectByToken(token: string): Promise<Project | null> {
  const { rows } = await query<Project>("SELECT * FROM projects WHERE review_token = $1", [token]);
  return rows[0] ?? null;
}

reviewRouter.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const project = await loadProjectByToken(req.params.token);
    if (!project) {
      res.status(404).json({ error: "unknown or revoked review link" });
      return;
    }
    const { rows: pins } = await query<Pin>(
      "SELECT * FROM pins WHERE project_id = $1 ORDER BY created_at DESC",
      [project.id],
    );
    res.json({ project: { name: project.name }, pins });
  }),
);

reviewRouter.get(
  "/:token/pins/:pinId/screenshot",
  asyncHandler(async (req, res) => {
    const project = await loadProjectByToken(req.params.token);
    if (!project) {
      res.status(404).end();
      return;
    }
    const { rows } = await query<Pin>(
      "SELECT screenshot_path FROM pins WHERE id = $1 AND project_id = $2",
      [req.params.pinId, project.id],
    );
    const path = rows[0]?.screenshot_path;
    if (!path) {
      res.status(404).end();
      return;
    }
    try {
      const buffer = await readScreenshot(path);
      res.setHeader("Content-Type", path.endsWith(".png") ? "image/png" : "image/jpeg");
      res.send(buffer);
    } catch {
      res.status(404).end();
    }
  }),
);
