export type VisitStatus = "ARRIVED" | "IDENTIFYING" | "ASSIGNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface VisitDTO {
  id: string;
  status: VisitStatus;
  storeId: string;
  customerId: string | null;
  assignedSalespersonId: string | null;
  arrivedAt: string;
  identifiedAt: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface VisitTimelineItem {
  id: string;
  eventType: string;
  actorId: string | null;
  metadata: unknown;
  createdAt: string;
}
