import type { RequestHandler } from "express";
import { query } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import type { Project } from "../types.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      project?: Project;
    }
  }
}

/** Requires `requireAuth` to have run first. Loads the project and checks team membership. */
export const requireProjectAccess: RequestHandler = asyncHandler(async (req, res, next) => {
  const { projectId } = req.params;
  const { rows } = await query<Project>(
    `SELECT p.* FROM projects p
       JOIN team_members tm ON tm.team_id = p.team_id
      WHERE p.id = $1 AND tm.user_id = $2`,
    [projectId, req.userId],
  );
  const project = rows[0];
  if (!project) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  req.project = project;
  next();
});
