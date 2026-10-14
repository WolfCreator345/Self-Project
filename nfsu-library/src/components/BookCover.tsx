import Image from "next/image";
import { coverHues, initials } from "@/lib/utils";

export function BookCover({
  title,
  coverUrl,
  sizes = "(min-width: 1280px) 220px, (min-width: 768px) 30vw, 45vw",
  className = "",
}: {
  title: string;
  coverUrl?: string | null;
  sizes?: string;
  className?: string;
}) {
  const [a, b] = coverHues(title);
  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-2xl bg-navy-50 ${className}`}>
      {coverUrl ? (
        <Image src={coverUrl} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <div
          className="flex size-full flex-col justify-between p-4 text-white"
          style={{ background: `linear-gradient(145deg, ${a}, ${b})` }}
          aria-hidden="true"
        >
          <span className="h-0.5 w-8 rounded-full bg-gold" />
          <span className="font-serif text-5xl leading-none tracking-tight italic">{initials(title)}</span>
          <span className="line-clamp-2 text-xs/snug font-medium text-white/80">{title}</span>
        </div>
      )}
    </div>
  );
}
