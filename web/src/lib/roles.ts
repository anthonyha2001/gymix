// Client-safe role definitions. Mirrors public.gym_role and public.can_assign_role()
// in the database — the database is the real enforcement, this only drives the UI.

export const GYM_ROLES = ["owner", "manager", "front_desk", "trainer", "dietitian", "member"] as const;
export type GymRole = (typeof GYM_ROLES)[number];

export const ROLE_LABELS: Record<GymRole, string> = {
  owner: "Owner",
  manager: "Manager",
  front_desk: "Front desk",
  trainer: "Trainer",
  dietitian: "Dietitian",
  member: "Member",
};

export function isStaffRole(role: GymRole) {
  return role !== "member";
}

// Mirrors public.can_handle_billing(): sell memberships, take payments, add members.
export const BILLING_ROLES: GymRole[] = ["owner", "manager", "front_desk"];
// Plans, voiding invoices, cancelling memberships, machines.
export const MANAGER_ROLES: GymRole[] = ["owner", "manager"];
// Build programs and templates. Mirrors public.can_coach().
export const COACH_ROLES: GymRole[] = ["owner", "manager", "trainer"];
// Nutrition plans (public.can_diet()) are no longer edited in Gymix: nutrition
// will live in the separate Nutrix app (see README, "Nutrition and Nutrix").

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
