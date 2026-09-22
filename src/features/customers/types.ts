export interface CustomerSnapshot {
  id: string;
  name: string;
  phone: string;
  visitCount: number;
  lastVisitAt: string | null;
  purchaseCount: number;
  area?: string | null;
  budget?: string | null;
  source?: string | null;
  /** Store-set loyalty tier (migration 160). Null = no tier. */
  tier: string | null;
}

export interface CustomerDetail extends CustomerSnapshot {
  email: string | null;
  city: string | null;
  area: string | null;
  budget: string | null;
  source: string | null;
}
