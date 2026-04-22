"""Fetches and cleans legal content from URLs or raw text input."""

import httpx
from bs4 import BeautifulSoup
import re
from typing import Optional


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

MAX_CONTENT_CHARS = 12000  # Stay within token budget for analysis


async def fetch_url_content(url: str) -> dict:
    """Fetch and extract clean text from a URL."""
    try:
        async with httpx.AsyncClient(
            headers=HEADERS,
            follow_redirects=True,
            timeout=20.0,
        ) as client:
            response = await client.get(url)
            response.raise_for_status()
            html = response.text

        return _parse_html(html, url)

    except httpx.HTTPStatusError as e:
        return {"error": f"HTTP {e.response.status_code}: Could not fetch {url}", "content": ""}
    except httpx.RequestError as e:
        return {"error": f"Network error: {str(e)}", "content": ""}
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}", "content": ""}


def _parse_html(html: str, url: str) -> dict:
    """Extract meaningful content from HTML."""
    soup = BeautifulSoup(html, "lxml")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "footer", "header",
                     "aside", "advertisement", "form", "button",
                     "noscript", "iframe", "img", "svg"]):
        tag.decompose()

    # Extract title
    title = ""
    if soup.title:
        title = soup.title.get_text(strip=True)
    elif soup.find("h1"):
        title = soup.find("h1").get_text(strip=True)

    # Try to find the main article body
    content_candidates = [
        soup.find("article"),
        soup.find(attrs={"class": re.compile(r"(content|article|main|post|body|entry)", re.I)}),
        soup.find(attrs={"id": re.compile(r"(content|article|main|post|body)", re.I)}),
        soup.find("main"),
        soup.body,
    ]

    content_tag = next((c for c in content_candidates if c is not None), soup)

    # Extract paragraphs
    paragraphs = content_tag.find_all(["p", "h1", "h2", "h3", "h4", "blockquote", "li"])
    text_parts = []
    for p in paragraphs:
        text = p.get_text(separator=" ", strip=True)
        if len(text) > 30:  # Filter out very short/nav items
            text_parts.append(text)

    raw_content = "\n\n".join(text_parts)
    raw_content = _clean_text(raw_content)

    # Truncate to max chars
    if len(raw_content) > MAX_CONTENT_CHARS:
        raw_content = raw_content[:MAX_CONTENT_CHARS] + "\n\n[Content truncated for analysis]"

    return {
        "title": title,
        "url": url,
        "content": raw_content,
        "char_count": len(raw_content),
        "error": None,
    }


def _clean_text(text: str) -> str:
    """Clean and normalize extracted text."""
    # Collapse multiple whitespace/newlines
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    # Remove stray characters
    text = re.sub(r"[^\x09\x0A\x0D\x20-\x7E -￿]", "", text)
    return text.strip()


def prepare_content_for_analysis(
    topic: str,
    raw_text: Optional[str] = None,
    url_data: Optional[dict] = None,
) -> str:
    """Combine topic + fetched content into a clean analysis prompt."""
    parts = [f"TOPIC: {topic}"]

    if url_data and url_data.get("content"):
        if url_data.get("title"):
            parts.append(f"SOURCE TITLE: {url_data['title']}")
        if url_data.get("url"):
            parts.append(f"SOURCE URL: {url_data['url']}")
        parts.append(f"\nARTICLE CONTENT:\n{url_data['content']}")

    if raw_text and raw_text.strip():
        parts.append(f"\nADDITIONAL CONTEXT PROVIDED BY USER:\n{raw_text.strip()}")

    return "\n\n".join(parts)
