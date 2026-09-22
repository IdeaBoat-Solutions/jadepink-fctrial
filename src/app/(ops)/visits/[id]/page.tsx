"use client";

import { useParams } from "next/navigation";
import { VisitWorkspace } from "@/components/floor/visit-workspace";

export default function VisitPage() {
  const { id } = useParams<{ id: string }>();
  return <VisitWorkspace visitId={id} />;
}
