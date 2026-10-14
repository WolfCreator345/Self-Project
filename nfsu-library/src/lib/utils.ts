export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "to", "in", "for", "on"]);

export function initials(title: string) {
  const words = title
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w.toLowerCase()));
  return (words[0]?.[0] ?? "?").toUpperCase() + (words[1]?.[0] ?? "").toUpperCase();
}

export function addedAgo(date: Date, now = new Date()) {
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Added today";
  if (days === 1) return "Added yesterday";
  if (days < 30) return `Added ${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Added ${months} month${months > 1 ? "s" : ""} ago`;
  const years = Math.floor(days / 365);
  return `Added ${years} year${years > 1 ? "s" : ""} ago`;
}

/** Deterministic hue pair for the fallback cover gradient. */
export function coverHues(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const palettes = [
    ["#332B66", "#5B4FA8"],
    ["#1F2A44", "#3E5C8A"],
    ["#4A2545", "#8E3B5F"],
    ["#233D3A", "#3F7D6E"],
    ["#3D2B1F", "#8A6A3B"],
    ["#2B2D42", "#5C5F8A"],
  ];
  return palettes[h % palettes.length];
}

export function todayLong(timeZone = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(new Date());
}

export function todayIso(timeZone = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}
