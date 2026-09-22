/* Role policy — single source of truth for "who may do/see what".
   UI visibility AND server enforcement read from here so they can't drift.
   Roles come from staff_profiles; the client store collapses them to
   "fc" | "manager" (STORE_MANAGER, ADMIN, MANAGEMENT all manage). */

export type ClientRole = "fc" | "manager";
export type StaffRole = "FC" | "STORE_MANAGER" | "ADMIN" | "MANAGEMENT";

const MANAGING: StaffRole[] = ["STORE_MANAGER", "ADMIN", "MANAGEMENT"];

export function isManagerRole(role: StaffRole | ClientRole | undefined | null): boolean {
  if (!role) return false;
  if (role === "manager") return true;
  if (role === "fc" || role === "FC") return false;
  return (MANAGING as string[]).includes(role);
}

/** Back-office (dashboard, inventory, orders, reports, suppliers, settings). */
export function canAccessAdmin(role: StaffRole | ClientRole | undefined | null): boolean {
  return isManagerRole(role);
}

/** Live floor — the manager's store-wide operational view. */
export function canViewLiveFloor(role: StaffRole | ClientRole | undefined | null): boolean {
  return isManagerRole(role);
}

/** Assigning a *different* FC. Everyone may take a customer themselves. */
export function canAssignOthers(role: StaffRole | ClientRole | undefined | null): boolean {
  return isManagerRole(role);
}

/** Reassigning a visit that already has an FC. */
export function canReassignVisit(role: StaffRole | ClientRole | undefined | null): boolean {
  return isManagerRole(role);
}
