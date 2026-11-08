// What a slide can show. Shared by the server page and the client form.
export const SLIDE_KINDS = [
  { value: "announcement", label: "Announcement", hint: "News, hours, events." },
  { value: "promo", label: "Offer", hint: "A promotion, with a photo." },
  { value: "schedule", label: "Classes today", hint: "The rest of today's classes, with spots left." },
  { value: "leaderboard", label: "Leaderboard", hint: "Most visits this month." },
  { value: "achievements", label: "Personal records", hint: "Members' new bests this week." },
  { value: "occupancy", label: "Right now", hint: "How busy the gym is." },
] as const;
