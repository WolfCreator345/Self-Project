import "dotenv/config";
import express from "express";
import cors from "cors";
import { conceptExplainerRouter } from "./modules/conceptExplainer/router.js";
import { socraticDialogueRouter } from "./modules/socraticDialogue/router.js";
import { cvReviewerRouter } from "./modules/cvReviewer/router.js";

const app = express();
const PORT = Number(process.env.PORT) || 8787;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Tech Law Learning & Placement Assistant API",
    note: "Study/prep tool — not a real-time exam aid.",
  });
});

app.use("/api/concept-explainer", conceptExplainerRouter);
app.use("/api/socratic", socraticDialogueRouter);
app.use("/api/cv-reviewer", cvReviewerRouter);

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

app.listen(PORT, () => {
  console.log(`Tech Law Learning & Placement Assistant API listening on http://localhost:${PORT}`);
});
