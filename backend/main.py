"""LexEdu — Legal Education Bot API."""

import os
import asyncio
import json
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from web_reader import fetch_url_content, prepare_content_for_analysis
from legal_analyzer import analyze_legal_content, generate_carousel_content, quick_summary
from carousel_generator import (
    render_carousel_html,
    render_carousel_preview_page,
    slides_to_text_export,
)

load_dotenv()

BASE_DIR = Path(__file__).parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
STATIC_DIR = FRONTEND_DIR / "static"

app = FastAPI(
    title="LexEdu — Legal Education Bot",
    description="AI-powered legal educator for students, scholars, and the public",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ─── Pages ───────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def home():
    index_path = FRONTEND_DIR / "index.html"
    return HTMLResponse(content=index_path.read_text())


# ─── API: Streaming Legal Analysis ───────────────────────────────────────────

@app.post("/api/analyze")
async def analyze(
    topic: str = Form(...),
    audience: str = Form("student"),
    url: Optional[str] = Form(None),
    raw_text: Optional[str] = Form(None),
):
    """Stream a full legal analysis to the client via SSE."""
    if not topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required.")

    if not url and not raw_text:
        raise HTTPException(
            status_code=400,
            detail="Provide either a URL or raw text content to analyze.",
        )

    # Fetch URL content if provided
    url_data = None
    if url and url.strip():
        url_data = await fetch_url_content(url.strip())
        if url_data.get("error") and not url_data.get("content"):
            raise HTTPException(status_code=422, detail=url_data["error"])

    content = prepare_content_for_analysis(topic, raw_text, url_data)

    async def event_stream():
        try:
            async for chunk in analyze_legal_content(topic, content, audience):
                # SSE format
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── API: Generate Carousels ─────────────────────────────────────────────────

@app.post("/api/carousel/generate")
async def generate_carousel(
    topic: str = Form(...),
    audience: str = Form("student"),
    analysis_text: Optional[str] = Form(None),
    url: Optional[str] = Form(None),
    raw_text: Optional[str] = Form(None),
):
    """Generate LinkedIn + Instagram carousel data for a legal topic."""
    if not topic.strip():
        raise HTTPException(status_code=400, detail="Topic is required.")

    # Build content for quick summary
    url_data = None
    if url and url.strip():
        url_data = await fetch_url_content(url.strip())

    content_for_summary = prepare_content_for_analysis(
        topic,
        raw_text or analysis_text or "",
        url_data,
    )

    # Get structured summary first (feeds into carousel generation)
    summary_data = await quick_summary(topic, content_for_summary)

    key_points_str = "\n".join(
        f"- {pt}" for pt in summary_data.get("key_points", [topic])
    )

    # Generate both platforms in parallel
    linkedin_task = generate_carousel_content(
        topic=topic,
        summary=summary_data.get("summary", ""),
        key_points=key_points_str,
        platform="linkedin",
        audience=audience,
        slide_count=8,
    )
    instagram_task = generate_carousel_content(
        topic=topic,
        summary=summary_data.get("summary", ""),
        key_points=key_points_str,
        platform="instagram",
        audience=audience,
        slide_count=7,
    )

    linkedin_data, instagram_data = await asyncio.gather(linkedin_task, instagram_task)

    return JSONResponse({
        "topic": topic,
        "summary": summary_data,
        "linkedin": linkedin_data,
        "instagram": instagram_data,
    })


# ─── API: Render Carousel HTML Preview ───────────────────────────────────────

@app.post("/api/carousel/preview", response_class=HTMLResponse)
async def preview_carousel(request: Request):
    """Render carousel HTML preview from posted JSON data."""
    body = await request.json()
    platform = body.get("platform", "linkedin")
    carousel_data = body.get("carousel_data", {})

    if not carousel_data:
        raise HTTPException(status_code=400, detail="carousel_data is required.")

    html = render_carousel_html(carousel_data, platform)
    return HTMLResponse(content=html)


# ─── API: Export Carousel as Text ─────────────────────────────────────────────

@app.post("/api/carousel/export-text")
async def export_carousel_text(request: Request):
    """Export carousel slides as plain text (copy-paste ready)."""
    body = await request.json()
    carousel_data = body.get("carousel_data", {})

    if not carousel_data:
        raise HTTPException(status_code=400, detail="carousel_data is required.")

    text = slides_to_text_export(carousel_data)
    return JSONResponse({"text": text})


# ─── Health ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "LexEdu Legal Education Bot"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
