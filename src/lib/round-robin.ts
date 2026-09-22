/* Stage 2 — FC assignment, round robin.
   Roadmap: "FC assigned — round robin. Manager can reassign any walk-in;
   the override is logged with who changed it."
   (Logging lives server-side: FC_ASSIGNED / FC_REASSIGNED visit_events with actor_id.)

   Pure helper so UI + tests share one rotation rule:
   - Roster order is stable (sorted by name, then id).
   - The next FC is the one after the most recently assigned visit.
   - Falls back to fewest active visits when there is no history to rotate from.
   - Never invents staff — empty roster returns null. */

export interface RosterMember {
  id: string;
  name: string;
  active?: boolean;
}

export interface AssignedVisit {
  assignedSalespersonId: string | null;
  assignedAt?: string | null;
  arrivedAt?: string;
  status?: string;
}

export function roundRobinNext(
  salespeople: RosterMember[],
  visits: AssignedVisit[],
): RosterMember | null {
  const roster = [...salespeople]
    .filter((s) => s.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  if (roster.length === 0) return null;
  if (roster.length === 1) return roster[0];

  // Most recently assigned visit decides the rotation pointer.
  const assigned = visits
    .filter((v) => v.assignedSalespersonId)
    .sort((a, b) => {
      const at = (v: AssignedVisit) =>
        v.assignedAt ? Date.parse(v.assignedAt) : v.arrivedAt ? Date.parse(v.arrivedAt) : 0;
      return at(b) - at(a);
    });
  const lastId = assigned[0]?.assignedSalespersonId ?? null;
  if (!lastId) {
    // No rotation history — fewest active visits wins (documented heuristic).
    return fewestLoad(roster, visits);
  }
  const idx = roster.findIndex((s) => s.id === lastId);
  // Unknown FC (left the store) → restart from the top of the roster.
  if (idx === -1) return roster[0];
  return roster[(idx + 1) % roster.length];
}

export function fewestLoad(roster: RosterMember[], visits: AssignedVisit[]): RosterMember {
  const load = new Map<string, number>();
  for (const v of visits) {
    if (!v.assignedSalespersonId) continue;
    if (v.status && !["ASSIGNED", "ACTIVE", "IDENTIFYING", "ARRIVED"].includes(v.status)) continue;
    load.set(v.assignedSalespersonId, (load.get(v.assignedSalespersonId) ?? 0) + 1);
  }
  return [...roster].sort(
    (a, b) =>
      (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0) || a.name.localeCompare(b.name),
  )[0];
}
