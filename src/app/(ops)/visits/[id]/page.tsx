"use client";

import { useParams } from "next/navigation";
import { VisitWorkspace } from "@/components/floor/visit-workspace";
import { usePageTitle } from "@/hooks/use-page-title";

export default function VisitPage() {
  usePageTitle("Visit");
  const { id } = useParams<{ id: string }>();
  return <VisitWorkspace visitId={id} />;
}
