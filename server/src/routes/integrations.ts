import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireProjectAccess } from "../middleware/requireProjectAccess.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import type { Integration } from "../types.js";

export const integrationsRouter = Router({ mergeParams: true });
integrationsRouter.use(requireAuth, requireProjectAccess);

integrationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await query<Integration>(
      "SELECT id, project_id, provider, created_at FROM integrations WHERE project_id = $1",
      [req.project!.id],
    );
    res.json({ integrations: rows });
  }),
);

const githubSchema = z.object({
  token: z.string().min(1),
  repo: z.string().regex(/^[^/\s]+\/[^/\s]+$/, "repo must be in owner/name form"),
});

integrationsRouter.put(
  "/github",
  asyncHandler(async (req, res) => {
    const parsed = githubSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid input" });
      return;
    }
    await query(
      `INSERT INTO integrations (project_id, provider, config)
       VALUES ($1, 'github', $2)
       ON CONFLICT (project_id, provider) DO UPDATE SET config = EXCLUDED.config`,
      [req.project!.id, JSON.stringify(parsed.data)],
    );
    res.status(204).end();
  }),
);

const linearSchema = z.object({
  apiKey: z.string().min(1),
  teamId: z.string().min(1),
});

integrationsRouter.put(
  "/linear",
  asyncHandler(async (req, res) => {
    const parsed = linearSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid input" });
      return;
    }
    await query(
      `INSERT INTO integrations (project_id, provider, config)
       VALUES ($1, 'linear', $2)
       ON CONFLICT (project_id, provider) DO UPDATE SET config = EXCLUDED.config`,
      [req.project!.id, JSON.stringify(parsed.data)],
    );
    res.status(204).end();
  }),
);

integrationsRouter.delete(
  "/:provider",
  asyncHandler(async (req, res) => {
    const { provider } = req.params;
    if (provider !== "github" && provider !== "linear") {
      res.status(400).json({ error: "unknown provider" });
      return;
    }
    await query("DELETE FROM integrations WHERE project_id = $1 AND provider = $2", [
      req.project!.id,
      provider,
    ]);
    res.status(204).end();
  }),
);
