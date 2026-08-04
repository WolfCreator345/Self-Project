import fs from "node:fs/promises";
import path from "node:path";

import type { ReportArchiver } from "./reportArchiver.js";

/**
 * Stores report PDFs on local disk instead of Google Drive. The Drive MCP
 * connector currently has a known regression — `create_file` fails with
 * "User cannot add children to the specified folder" whenever a `parentId`
 * is given, and there's no confirmed move/rename operation on that
 * connector to relocate a root-level file afterward — so archival is
 * local-only until that's fixed upstream. Swapping in a real Drive-backed
 * `ReportArchiver` later is a one-line change at this class's construction
 * site (jobs/src/index.ts), not a rewrite: nothing else depends on how or
 * where `store()` actually persists the file.
 */
export class LocalFileReportArchiver implements ReportArchiver {
  constructor(private readonly reportsDir: string) {}

  async store(pdf: Buffer, filename: string): Promise<string> {
    await fs.mkdir(this.reportsDir, { recursive: true });
    const filePath = path.join(this.reportsDir, filename);
    await fs.writeFile(filePath, pdf);
    return filePath;
  }
}
