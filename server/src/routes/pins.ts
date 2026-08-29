import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireProjectAccess } from "../middleware/requireProjectAccess.js";
import { requirePinAccess } from "../middleware/requirePinAccess.js";
import { deleteScreenshot, readScreenshot } from "../lib/screenshots.js";
import { createGithubIssue, type GithubConfig } from "../integrations/github.js";
import { createLinearIssue, type LinearConfig } from "../integrations/linear.js";
import { env } from "../env.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import type { Integration, Pin, PinStatus } from "../types.js";

/** Mounted at /api/projects/:projectId/pins - lists pins for a project the caller can access. */
export const pinsByProjectRouter = Router({ mergeParams: true });
pinsByProjectRouter.use(requireAuth, requireProjectAccess);

const listQuerySchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  pageUrl: z.string().optional(),
  reporter: z.string().optional(),
});

pinsByProjectRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid query" });
      return;
    }
    const { status, pageUrl, reporter } = parsed.data;

    const conditions = ["project_id = $1"];
    const params: unknown[] = [req.project!.id];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (pageUrl) {
      params.push(`%${pageUrl}%`);
      conditions.push(`page_url ILIKE $${params.length}`);
    }
    if (reporter) {
      params.push(`%${reporter}%`);
      conditions.push(
        `(reporter_name ILIKE $${params.length} OR reporter_email ILIKE $${params.length})`,
      );
    }

    const { rows } = await query<Pin>(
      `SELECT * FROM pins WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`,
      params,
    );
    res.json({ pins: rows });
  }),
);

/** Mounted at /api/pins/:pinId - operates on a single pin the caller can access via its project. */
export const pinRouter = Router();
pinRouter.use(requireAuth);

const updateSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]),
});

pinRouter.patch(
  "/:pinId",
  requirePinAccess,
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid status" });
      return;
    }
    const status: PinStatus = parsed.data.status;
    const { rows } = await query<Pin>(
      "UPDATE pins SET status = $1, updated_at = now() WHERE id = $2 RETURNING *",
      [status, req.pin!.id],
    );
    res.json({ pin: rows[0] });
  }),
);

pinRouter.get(
  "/:pinId/screenshot",
  requirePinAccess,
  asyncHandler(async (req, res) => {
    const path = req.pin!.screenshot_path;
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

pinRouter.delete(
  "/:pinId",
  requirePinAccess,
  asyncHandler(async (req, res) => {
    if (req.pin!.screenshot_path) {
      await deleteScreenshot(req.pin!.screenshot_path);
    }
    await query("DELETE FROM pins WHERE id = $1", [req.pin!.id]);
    res.status(204).end();
  }),
);

const createIssueSchema = z.object({
  provider: z.enum(["github", "linear"]),
});

pinRouter.post(
  "/:pinId/create-issue",
  requirePinAccess,
  asyncHandler(async (req, res) => {
    const parsed = createIssueSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid provider" });
      return;
    }
    const { provider } = parsed.data;
    const pin = req.pin!;

    if (pin.external_issue_url) {
      res.status(409).json({ error: "an issue has already been created for this pin" });
      return;
    }

    const { rows } = await query<Integration>(
      "SELECT * FROM integrations WHERE project_id = $1 AND provider = $2",
      [req.pinProject!.id, provider],
    );
    const integration = rows[0];
    if (!integration) {
      res.status(400).json({ error: `no ${provider} integration configured for this project` });
      return;
    }

    const dashboardUrl = `${env.DASHBOARD_ORIGIN}/projects/${req.pinProject!.id}/pins/${pin.id}`;

    try {
      const url =
        provider === "github"
          ? await createGithubIssue(
              integration.config as unknown as GithubConfig,
              pin,
              dashboardUrl,
            )
          : await createLinearIssue(
              integration.config as unknown as LinearConfig,
              pin,
              dashboardUrl,
            );

      const { rows: updated } = await query<Pin>(
        "UPDATE pins SET external_issue_url = $1, external_issue_provider = $2, updated_at = now() WHERE id = $3 RETURNING *",
        [url, provider, pin.id],
      );
      res.json({ pin: updated[0] });
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  }),
);
