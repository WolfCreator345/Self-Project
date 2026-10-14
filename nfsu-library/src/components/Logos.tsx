import Image from "next/image";
import mha from "../../public/logos/mha-logo.png";
import nfsu from "../../public/logos/nfsu-logo.png";

/** Ministry of Home Affairs logo — used as supplied, never redrawn. */
export function MhaLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src={mha}
      alt="Ministry of Home Affairs, Government of India"
      className={`h-auto w-auto object-contain ${className}`}
      sizes="(min-width: 768px) 112px, 76px"
      priority
    />
  );
}

/**
 * NFSU crest — used as supplied. The current file has a black background,
 * so it sits in a black rounded tile. Drop a transparent PNG at the same
 * path and remove `tile` to show it bare.
 */
export function NfsuCrest({ className = "", tile = true }: { className?: string; tile?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${tile ? "rounded-xl bg-black p-1" : ""} ${className}`}>
      <Image
        src={nfsu}
        alt="National Forensic Sciences University crest"
        className="h-full w-auto object-contain"
        sizes="64px"
        priority
      />
    </span>
  );
}
