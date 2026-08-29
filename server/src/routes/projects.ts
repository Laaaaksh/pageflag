import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireProjectAccess } from "../middleware/requireProjectAccess.js";
import { generatePublicKey, generateReviewToken } from "../lib/keys.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import type { Project, Team } from "../types.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { rows } = await query<Project>(
      `SELECT p.* FROM projects p
         JOIN team_members tm ON tm.team_id = p.team_id
        WHERE tm.user_id = $1
        ORDER BY p.created_at DESC`,
      [req.userId],
    );
    res.json({ projects: rows });
  }),
);

const createSchema = z.object({
  name: z.string().min(1),
  teamId: z.string().uuid(),
  allowedDomains: z.array(z.string()).default([]),
});

projectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid input" });
      return;
    }
    const { name, teamId, allowedDomains } = parsed.data;

    const { rows: membership } = await query<Team>(
      "SELECT t.* FROM teams t JOIN team_members tm ON tm.team_id = t.id WHERE t.id = $1 AND tm.user_id = $2",
      [teamId, req.userId],
    );
    if (membership.length === 0) {
      res.status(403).json({ error: "not a member of that team" });
      return;
    }

    const { rows } = await query<Project>(
      `INSERT INTO projects (team_id, name, public_key, review_token, allowed_domains)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [teamId, name, generatePublicKey(), generateReviewToken(), allowedDomains],
    );
    res.status(201).json({ project: rows[0] });
  }),
);

projectsRouter.get("/:projectId", requireProjectAccess, (req, res) => {
  res.json({ project: req.project });
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  allowedDomains: z.array(z.string()).optional(),
});

projectsRouter.patch(
  "/:projectId",
  requireProjectAccess,
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid input" });
      return;
    }
    const project = req.project!;
    const name = parsed.data.name ?? project.name;
    const allowedDomains = parsed.data.allowedDomains ?? project.allowed_domains;

    const { rows } = await query<Project>(
      "UPDATE projects SET name = $1, allowed_domains = $2 WHERE id = $3 RETURNING *",
      [name, allowedDomains, project.id],
    );
    res.json({ project: rows[0] });
  }),
);

projectsRouter.delete(
  "/:projectId",
  requireProjectAccess,
  asyncHandler(async (req, res) => {
    await query("DELETE FROM projects WHERE id = $1", [req.project!.id]);
    res.status(204).end();
  }),
);

projectsRouter.post(
  "/:projectId/regenerate-review-token",
  requireProjectAccess,
  asyncHandler(async (req, res) => {
    const { rows } = await query<Project>(
      "UPDATE projects SET review_token = $1 WHERE id = $2 RETURNING *",
      [generateReviewToken(), req.project!.id],
    );
    res.json({ project: rows[0] });
  }),
);
