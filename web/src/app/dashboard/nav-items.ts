import { BILLING_ROLES, COACH_ROLES, MANAGER_ROLES, type GymRole } from "@/lib/roles";

// Icons are referenced by name so this list can be built on the server and
// passed to the client sidebar (components can't cross that boundary).
export type NavIcon =
  | "overview"
  | "checkin"
  | "members"
  | "billing"
  | "plans"
  | "team"
  | "settings"
  | "schedule"
  | "machines"
  | "programs"
  | "messages"
  | "access"
  | "live"
  | "shop"
  | "screens"
  | "reception"
  | "challenges"
  | "announce";

export type NavItem = { href: string; label: string; icon: NavIcon; badge?: number; group?: NavGroup };
export type NavGroup = "Today" | "People" | "Money" | "Gym";

// feature: shown only while that feature switch is on for the gym.
const NAV: (NavItem & { roles?: GymRole[]; feature?: string })[] = [
  { group: "Today", href: "/dashboard", label: "Overview", icon: "overview" },
  { group: "Today", href: "/dashboard/check-in", label: "Check-in", icon: "checkin", roles: BILLING_ROLES },
  { group: "Today", href: "/dashboard/live", label: "Live", icon: "live", roles: BILLING_ROLES, feature: "live_occupancy" },
  { group: "Today", href: "/dashboard/reception", label: "Reception", icon: "reception", roles: BILLING_ROLES, feature: "self_service" },
  { group: "People", href: "/dashboard/members", label: "Members", icon: "members" },
  { group: "People", href: "/dashboard/schedule", label: "Schedule", icon: "schedule" },
  { group: "People", href: "/dashboard/messages", label: "Messages", icon: "messages" },
  { group: "People", href: "/dashboard/announce", label: "Announce", icon: "announce", roles: MANAGER_ROLES },
  { group: "People", href: "/dashboard/challenges", label: "Challenges", icon: "challenges", roles: MANAGER_ROLES, feature: "challenges" },
  { group: "People", href: "/dashboard/programs", label: "Programs", icon: "programs", roles: COACH_ROLES },
  { group: "Money", href: "/dashboard/billing", label: "Billing", icon: "billing", roles: BILLING_ROLES },
  { group: "Money", href: "/dashboard/shop", label: "Shop", icon: "shop", roles: BILLING_ROLES, feature: "pos" },
  { group: "Money", href: "/dashboard/plans", label: "Plans", icon: "plans", roles: MANAGER_ROLES },
  { group: "Gym", href: "/dashboard/machines", label: "Equipment", icon: "machines", roles: ["owner", "manager", "front_desk", "trainer"] },
  { group: "Gym", href: "/dashboard/access", label: "Access", icon: "access", roles: MANAGER_ROLES, feature: "access_control" },
  { group: "Gym", href: "/dashboard/screens", label: "Screens", icon: "screens", roles: MANAGER_ROLES, feature: "screens" },
  { group: "Gym", href: "/dashboard/team", label: "Team", icon: "team" },
  { group: "Gym", href: "/dashboard/settings", label: "Settings", icon: "settings", roles: ["owner"] },
];

// Features shown greyed out until they ship (empty = section hidden).
export const COMING_SOON: { label: string; icon: NavIcon }[] = [];

export type NavCounts = { messages: number; programs: number; schedule: number };

const COUNT_FOR: Record<string, keyof NavCounts> = {
  "/dashboard/messages": "messages",
  "/dashboard/programs": "programs",
  "/dashboard/schedule": "schedule",
};

export function navFor(role: GymRole, counts: Partial<NavCounts> = {}, features: ReadonlySet<string> = new Set()): NavItem[] {
  return NAV.filter((item) => (!item.roles || item.roles.includes(role)) && (!item.feature || features.has(item.feature))).map(({ href, label, icon, group }) => {
    const n = COUNT_FOR[href] ? (counts[COUNT_FOR[href]] ?? 0) : 0;
    return { href, label, icon, group, badge: n > 0 ? n : undefined };
  });
}
