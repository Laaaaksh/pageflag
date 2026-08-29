import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SCREENSHOT_DIR: z.string().default("./data/screenshots"),
  DASHBOARD_ORIGIN: z.string().default("http://localhost:5173"),
});

export const env = schema.parse(process.env);
