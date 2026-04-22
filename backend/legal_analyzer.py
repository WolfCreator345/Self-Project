"""Core legal analysis engine powered by Claude with prompt caching."""

import anthropic
import json
from typing import Optional, AsyncGenerator

from prompts import (
    LEGAL_SYSTEM_PROMPT,
    CAROUSEL_SYSTEM_PROMPT,
    ANALYSIS_PROMPT_TEMPLATE,
    CAROUSEL_GENERATION_TEMPLATE,
)


# Audiences supported by the bot
AUDIENCES = {
    "student": "Law students and early learners seeking foundational understanding",
    "scholar": "Legal scholars, academics, and senior practitioners seeking jurisprudential depth",
    "public": "General public and non-law professionals wanting practical, relatable explanations",
}

PLATFORMS = ["linkedin", "instagram"]


def _get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic()


async def analyze_legal_content(
    topic: str,
    content: str,
    audience: str = "student",
) -> AsyncGenerator[str, None]:
    """
    Stream a full jurisprudential legal analysis using Claude.
    Uses prompt caching on the system prompt to reduce latency and cost.
    """
    client = _get_client()

    audience_desc = AUDIENCES.get(audience, AUDIENCES["student"])
    user_prompt = ANALYSIS_PROMPT_TEMPLATE.format(
        content=content,
        topic=topic,
        audience=audience_desc,
    )

    # Use prompt caching on the (large, reusable) system prompt
    with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": LEGAL_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_prompt}],
    ) as stream:
        for text_chunk in stream.text_stream:
            yield text_chunk


async def generate_carousel_content(
    topic: str,
    summary: str,
    key_points: str,
    platform: str = "linkedin",
    audience: str = "student",
    slide_count: int = 7,
) -> dict:
    """
    Generate structured carousel slide data using Claude.
    Returns parsed JSON with slide content.
    Uses prompt caching on the carousel system prompt.
    """
    client = _get_client()

    user_prompt = CAROUSEL_GENERATION_TEMPLATE.format(
        topic=topic,
        summary=summary,
        key_points=key_points,
        platform=platform,
        audience=AUDIENCES.get(audience, AUDIENCES["student"]),
        slide_count=slide_count,
    )

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        system=[
            {
                "type": "text",
                "text": CAROUSEL_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw_text = response.content[0].text

    # Extract JSON from the response (handle markdown code blocks)
    json_str = _extract_json(raw_text)
    try:
        carousel_data = json.loads(json_str)
    except json.JSONDecodeError:
        # Fallback: return raw text wrapped in an error-safe structure
        carousel_data = {
            "platform": platform,
            "topic": topic,
            "theme_color": "#1a3a5c",
            "theme_name": "Legal Blue",
            "slides": [],
            "raw_output": raw_text,
            "parse_error": True,
        }

    return carousel_data


async def quick_summary(topic: str, content: str) -> dict:
    """
    Generate a quick summary + key points for carousel seeding.
    This is called before carousel generation to extract structured info.
    """
    client = _get_client()

    prompt = f"""You are a legal educator. Given the following legal topic and content, extract:
1. A 2-3 sentence plain-English summary
2. Five key legal points (each max 20 words)
3. The primary legal domain (e.g., Constitutional Law, Criminal Law, etc.)
4. The relevant jurisdiction or scope (e.g., India, US, International)

Return ONLY valid JSON in this exact format:
{{
  "summary": "...",
  "key_points": ["point1", "point2", "point3", "point4", "point5"],
  "legal_domain": "...",
  "jurisdiction": "..."
}}

TOPIC: {topic}

CONTENT:
{content[:4000]}"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=800,
        system=[
            {
                "type": "text",
                "text": "You are a precise legal content extractor. Always return valid JSON only.",
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text
    json_str = _extract_json(raw)

    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        return {
            "summary": "Legal analysis in progress.",
            "key_points": [topic],
            "legal_domain": "General Law",
            "jurisdiction": "General",
        }


def _extract_json(text: str) -> str:
    """Extract JSON from text that may contain markdown code blocks."""
    import re
    # Try to find JSON inside ```json ... ``` or ``` ... ```
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        return match.group(1).strip()
    # Try to find raw JSON object
    match = re.search(r"(\{[\s\S]+\})", text)
    if match:
        return match.group(1).strip()
    return text.strip()
