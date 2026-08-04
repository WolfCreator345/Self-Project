import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { LocalFileReportArchiver } from "../src/localFileReportArchiver.js";

describe("LocalFileReportArchiver", () => {
  it("writes the PDF to the configured directory, creating it if needed, and returns the path", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "report-archiver-test-"));
    const reportsDir = path.join(dir, "nested", "reports"); // doesn't exist yet
    const archiver = new LocalFileReportArchiver(reportsDir);

    const returnedPath = await archiver.store(Buffer.from("fake pdf bytes"), "report.pdf");

    assert.equal(returnedPath, path.join(reportsDir, "report.pdf"));
    const written = await fs.readFile(returnedPath, "utf8");
    assert.equal(written, "fake pdf bytes");

    await fs.rm(dir, { recursive: true, force: true });
  });
});
