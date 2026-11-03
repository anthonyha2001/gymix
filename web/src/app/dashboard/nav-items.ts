import { BILLING_ROLES, MANAGER_ROLES, type GymRole } from "@/lib/roles";

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
  | "programs";

export type NavItem = { href: string; label: string; icon: NavIcon };

const NAV: (NavItem & { roles?: GymRole[] })[] = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/dashboard/check-in", label: "Check-in", icon: "checkin", roles: BILLING_ROLES },
  { href: "/dashboard/members", label: "Members", icon: "members" },
  { href: "/dashboard/billing", label: "Billing", icon: "billing", roles: BILLING_ROLES },
  { href: "/dashboard/plans", label: "Plans", icon: "plans", roles: MANAGER_ROLES },
  { href: "/dashboard/team", label: "Team", icon: "team" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings", roles: ["owner"] },
];

export const COMING_SOON: { label: string; icon: NavIcon }[] = [
  { label: "Schedule", icon: "schedule" },
  { label: "Machines", icon: "machines" },
  { label: "Programs", icon: "programs" },
];

export function navFor(role: GymRole): NavItem[] {
  return NAV.filter((item) => !item.roles || item.roles.includes(role)).map(({ href, label, icon }) => ({
    href,
    label,
    icon,
  }));
}
