export interface CustomerSnapshot {
  id: string;
  name: string;
  phone: string;
  visitCount: number;
  lastVisitAt: string | null;
  purchaseCount: number;
}

export interface CustomerDetail extends CustomerSnapshot {
  email: string | null;
  city: string | null;
  source: string | null;
}
