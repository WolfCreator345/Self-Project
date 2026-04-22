"""Renders carousel slide data into styled HTML pages for preview and export."""

from jinja2 import Environment, FileSystemLoader, select_autoescape
import os
import json
from pathlib import Path

TEMPLATES_DIR = Path(__file__).parent.parent / "frontend" / "templates"

# Platform-specific design tokens
PLATFORM_THEMES = {
    "linkedin": {
        "slide_size": "1080x1350",
        "font_family": "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        "primary": "#0A66C2",
        "accent": "#FFFFFF",
        "background": "#F3F2EF",
        "card_bg": "#FFFFFF",
        "text_dark": "#1C1C1C",
        "text_muted": "#666666",
        "badge_color": "#0A66C2",
    },
    "instagram": {
        "slide_size": "1080x1080",
        "font_family": "'Inter', 'Roboto', Arial, sans-serif",
        "primary": "#833AB4",
        "accent": "#FFFFFF",
        "background": "#FAFAFA",
        "card_bg": "#FFFFFF",
        "text_dark": "#1C1C1C",
        "text_muted": "#8e8e8e",
        "badge_color": "#E1306C",
    },
}

SLIDE_TYPE_GRADIENTS = {
    "hook":         "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    "context":      "linear-gradient(135deg, #0f3460 0%, #16213e 100%)",
    "definition":   "linear-gradient(135deg, #1B4332 0%, #2D6A4F 100%)",
    "case_example": "linear-gradient(135deg, #7B2D00 0%, #B5451B 100%)",
    "jurisprudence":"linear-gradient(135deg, #4A0E8F 0%, #7B2FBE 100%)",
    "impact":       "linear-gradient(135deg, #1a3a5c 0%, #2E6DA4 100%)",
    "summary":      "linear-gradient(135deg, #003049 0%, #023E7D 100%)",
    "cta":          "linear-gradient(135deg, #B5179E 0%, #7209B7 100%)",
    "default":      "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)",
}

SLIDE_TYPE_ICONS = {
    "hook":         "⚖️",
    "context":      "📖",
    "definition":   "📝",
    "case_example": "🏛️",
    "jurisprudence":"🔍",
    "impact":       "🌍",
    "summary":      "💡",
    "cta":          "📌",
    "default":      "⚖️",
}


def render_carousel_html(carousel_data: dict, platform: str = "linkedin") -> str:
    """
    Render full HTML carousel preview page from carousel JSON data.
    Returns the HTML string.
    """
    theme = PLATFORM_THEMES.get(platform, PLATFORM_THEMES["linkedin"])
    theme_color = carousel_data.get("theme_color", theme["primary"])
    slides = carousel_data.get("slides", [])

    # Enrich each slide with rendering metadata
    enriched_slides = []
    for slide in slides:
        slide_type = slide.get("type", "default")
        enriched = {
            **slide,
            "gradient": SLIDE_TYPE_GRADIENTS.get(slide_type, SLIDE_TYPE_GRADIENTS["default"]),
            "type_icon": SLIDE_TYPE_ICONS.get(slide_type, SLIDE_TYPE_ICONS["default"]),
            "theme_color": theme_color,
        }
        enriched_slides.append(enriched)

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    template = env.get_template("carousel.html")

    return template.render(
        slides=enriched_slides,
        platform=platform,
        theme=theme,
        theme_color=theme_color,
        topic=carousel_data.get("topic", ""),
        theme_name=carousel_data.get("theme_name", "Legal Series"),
        slide_count=len(enriched_slides),
        is_linkedin=(platform == "linkedin"),
        is_instagram=(platform == "instagram"),
    )


def render_carousel_preview_page(
    linkedin_data: dict,
    instagram_data: dict,
    topic: str,
    analysis_html: str = "",
) -> str:
    """Render a combined preview page showing both platform carousels."""
    linkedin_html = render_carousel_html(linkedin_data, "linkedin")
    instagram_html = render_carousel_html(instagram_data, "instagram")

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
    )
    template = env.get_template("preview.html")

    return template.render(
        topic=topic,
        linkedin_carousel=linkedin_html,
        instagram_carousel=instagram_html,
        analysis_html=analysis_html,
    )


def slides_to_text_export(carousel_data: dict) -> str:
    """Convert carousel slides to plain text format for copy-paste."""
    lines = []
    platform = carousel_data.get("platform", "").upper()
    topic = carousel_data.get("topic", "")
    lines.append(f"{'='*60}")
    lines.append(f"  {platform} CAROUSEL — {topic.upper()}")
    lines.append(f"{'='*60}\n")

    for slide in carousel_data.get("slides", []):
        slide_num = slide.get("slide_number", "?")
        slide_type = slide.get("type", "").upper()
        headline = slide.get("headline", "")
        emoji = slide.get("emoji", "")
        visual = slide.get("visual_suggestion", "")

        lines.append(f"--- SLIDE {slide_num} [{slide_type}] {emoji} ---")
        lines.append(f"HEADLINE: {headline}")

        if "subtext" in slide:
            lines.append(f"TEXT: {slide['subtext']}")
        if "points" in slide:
            for i, pt in enumerate(slide["points"], 1):
                lines.append(f"  {i}. {pt}")
        if "key_takeaway" in slide:
            lines.append(f"KEY TAKEAWAY: {slide['key_takeaway']}")

        lines.append(f"VISUAL: {visual}")
        lines.append("")

    return "\n".join(lines)
