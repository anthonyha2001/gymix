// Client-safe role definitions. Mirrors public.gym_role and public.can_assign_role()
// in the database — the database is the real enforcement, this only drives the UI.

export const GYM_ROLES = ["owner", "manager", "front_desk", "trainer", "member"] as const;
export type GymRole = (typeof GYM_ROLES)[number];

export const ROLE_LABELS: Record<GymRole, string> = {
  owner: "Owner",
  manager: "Manager",
  front_desk: "Front desk",
  trainer: "Trainer",
  member: "Member",
};

export function isStaffRole(role: GymRole) {
  return role !== "member";
}

// Mirrors public.can_handle_billing(): sell memberships, take payments, add members.
export const BILLING_ROLES: GymRole[] = ["owner", "manager", "front_desk"];
// Plans, voiding invoices, cancelling memberships.
export const MANAGER_ROLES: GymRole[] = ["owner", "manager"];

export function assignableRoles(by: GymRole): GymRole[] {
  switch (by) {
    case "owner":
      return ["manager", "front_desk", "trainer", "member"];
    case "manager":
      return ["front_desk", "trainer", "member"];
    case "front_desk":
      return ["member"];
    default:
      return [];
  }
}

export function isGymRole(value: unknown): value is GymRole {
  return typeof value === "string" && (GYM_ROLES as readonly string[]).includes(value);
}
