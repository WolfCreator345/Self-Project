import type { TDocumentDefinitions } from "pdfmake/interfaces.js";
// @ts-expect-error -- pdfmake's server build has no .d.ts for these internal
// entry points; only the browser-facing build/pdfmake.d.ts is typed.
import * as PdfPrinterModule from "pdfmake/js/Printer.js";
// @ts-expect-error -- see above
import * as URLResolverModule from "pdfmake/js/URLResolver.js";
// @ts-expect-error -- see above
import * as VirtualFsModule from "pdfmake/js/virtual-fs.js";

/**
 * pdfmake's Node build is authored in CommonJS with Babel's __esModule
 * interop. Importing it as real ESM (tsx/Node ESM, not ts-jest's CJS
 * transform) wraps the whole CJS `module.exports` object as `.default`, and
 * that object's own `.default` is the actual class/instance — so each of
 * these needs unwrapping twice. Verified empirically against the installed
 * pdfmake@0.3.11 before relying on it; if a future pdfmake version changes
 * its build output shape, this is the one place that needs updating.
 */
const PdfPrinter = (PdfPrinterModule as any).default.default;
const URLResolver = (URLResolverModule as any).default.default;
/** Singleton instance (not a class) — pdfmake/js/base.js wires it the same way. */
const vfs = (VirtualFsModule as any).default.default;

/**
 * A PdfPrinter configured with only the 14 standard PDF fonts (the
 * Helvetica family) — no TTF files to embed or fetch, so this renders fully
 * offline with no headless-browser dependency, per the Phase 7 brief.
 */
export function createPdfPrinter(): any {
  const fonts = {
    Helvetica: {
      normal: "Helvetica",
      bold: "Helvetica-Bold",
      italics: "Helvetica-Oblique",
      bolditalics: "Helvetica-BoldOblique",
    },
  };
  const urlResolver = new URLResolver(vfs);
  return new PdfPrinter(fonts, vfs, urlResolver);
}

export async function renderPdfToBuffer(printer: any, docDefinition: TDocumentDefinitions): Promise<Buffer> {
  const pdfDoc = await printer.createPdfKitDocument(docDefinition);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}
