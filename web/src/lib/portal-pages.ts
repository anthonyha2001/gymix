// Member portal pages the gym owner can switch on or off. Client-safe.
// Mirrors the check constraint on gyms.portal_hidden.
export const PORTAL_PAGES = [
  { id: "train", label: "Train", description: "Start and log workouts" },
  { id: "programs", label: "Programs", description: "Trainer programs, own programs, requests" },
  { id: "machines", label: "Machines", description: "Equipment and how to use it" },
  { id: "schedule", label: "Schedule", description: "Classes and PT sessions" },
  { id: "progress", label: "Progress", description: "Body measurements and workout history" },
  { id: "messages", label: "Chat", description: "Messages with staff" },
] as const;

export type PortalPage = (typeof PORTAL_PAGES)[number]["id"];
