import { describe, it, expect } from "vitest";
import { saveScreenshot, readScreenshot, deleteScreenshot } from "../src/lib/screenshots.js";
import { TINY_PNG_DATA_URL } from "./helpers.js";

describe("screenshot storage", () => {
  it("round-trips a saved screenshot", async () => {
    const filename = await saveScreenshot(TINY_PNG_DATA_URL);
    expect(filename).toMatch(/\.png$/);
    const buffer = await readScreenshot(filename);
    expect(buffer.length).toBeGreaterThan(0);
    await deleteScreenshot(filename);
  });

  it("rejects a non-image data URL", async () => {
    await expect(saveScreenshot("data:text/plain;base64,aGVsbG8=")).rejects.toThrow(
      /unsupported screenshot format/,
    );
  });

  it("refuses to read a filename that tries to escape the screenshot directory", async () => {
    await expect(readScreenshot("../../etc/passwd")).rejects.toThrow(/invalid screenshot filename/);
  });
});
