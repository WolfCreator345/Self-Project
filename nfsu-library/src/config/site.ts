export const SITE = {
  name: "NFSU Library, Bhubaneswar Campus",
  shortName: "NFSU Library",
  university: "National Forensic Sciences University, Bhubaneswar Campus",
  contactEmail: "library_bbs@nfsu.ac.in",
  description:
    "Search the catalogue, discover new arrivals and read today's Odia e-newspapers at the NFSU Library, Bhubaneswar Campus.",
};

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/#new-arrivals", label: "New Arrivals" },
  { href: "/books", label: "Collections" },
  { href: "/newspapers", label: "E-Newspapers" },
  { href: "/#about", label: "About/Timings" },
] as const;
