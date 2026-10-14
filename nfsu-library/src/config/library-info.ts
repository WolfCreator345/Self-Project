/**
 * Library details shown in the dark "About / Timings" band.
 * ⚠️ PLACEHOLDERS — confirm with the Library and edit here before launch.
 */
export const LIBRARY_INFO = {
  timings: [
    { days: "Monday – Friday", hours: "9:00 AM – 8:00 PM" },
    { days: "Saturday", hours: "9:00 AM – 5:00 PM" },
    { days: "Sunday & gazetted holidays", hours: "Closed" },
  ],
  location: {
    line1: "Central Library",
    line2: "NFSU Bhubaneswar Campus, Odisha",
    note: "Ask at the main reception if you need directions.",
  },
  borrowing: [
    "Bring your NFSU ID card to borrow or return books.",
    "Students may borrow up to 3 books at a time for 14 days.",
    "Faculty may borrow up to 5 books at a time for 30 days.",
    "Reference books, journals and newspapers are for reading in the library only.",
    "Renew or return on time. Late returns may attract a fine.",
  ],
} as const;
