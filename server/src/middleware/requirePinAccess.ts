import type { RequestHandler } from "express";
import { query } from "../db.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import type { Pin, Project } from "../types.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      pin?: Pin;
      pinProject?: Project;
    }
  }
}

/** Requires `requireAuth` to have run first. Loads the pin and its project via team membership. */
export const requirePinAccess: RequestHandler = asyncHandler(async (req, res, next) => {
  const { pinId } = req.params;
  const { rows: pinRows } = await query<Pin>("SELECT * FROM pins WHERE id = $1", [pinId]);
  const pin = pinRows[0];
  if (!pin) {
    res.status(404).json({ error: "pin not found" });
    return;
  }

  const { rows: projectRows } = await query<Project>(
    `SELECT p.* FROM projects p
       JOIN team_members tm ON tm.team_id = p.team_id
      WHERE p.id = $1 AND tm.user_id = $2`,
    [pin.project_id, req.userId],
  );
  const project = projectRows[0];
  if (!project) {
    res.status(404).json({ error: "pin not found" });
    return;
  }

  req.pin = pin;
  req.pinProject = project;
  next();
});
