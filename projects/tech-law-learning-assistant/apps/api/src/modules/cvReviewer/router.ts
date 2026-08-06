import { Router, type Request } from "express";
import multer from "multer";
// pdf-parse ships as CommonJS with no types; import via default interop.
import pdfParse from "pdf-parse";
import type { CvReviewResponse } from "../../types.js";
import { SAMPLE_JOB_POSTINGS } from "./jobPostings.js";
import { matchAgainstAllJobs } from "./atsMatcher.js";
import { analyzeGaps } from "./gapAnalyzer.js";

export const cvReviewerRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

type RequestWithFile = Request & { file?: Express.Multer.File };

async function extractCvText(req: RequestWithFile): Promise<string> {
  const file = req.file;
  if (file) {
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      const parsed = await pdfParse(file.buffer);
      return parsed.text;
    }
    return file.buffer.toString("utf-8");
  }
  const body = req.body as { cvText?: string };
  return (body.cvText ?? "").trim();
}

cvReviewerRouter.post("/analyze", upload.single("cv"), async (req, res) => {
  try {
    const cvText = await extractCvText(req);

    if (!cvText || cvText.trim().length < 20) {
      res.status(400).json({
        error: "Provide CV text (cvText field) or upload a .pdf/.txt file with meaningful content.",
      });
      return;
    }

    const perJobMatches = matchAgainstAllJobs(cvText, SAMPLE_JOB_POSTINGS);
    const best = perJobMatches[0];
    const gaps = analyzeGaps(cvText);

    const response: CvReviewResponse = {
      atsScore: best.score,
      bestMatchJobTitle: best.jobTitle,
      matchedKeywords: best.matchedKeywords,
      missingKeywords: best.missingKeywords,
      gaps,
      perJobMatches,
    };

    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Failed to analyze CV: ${message}` });
  }
});
