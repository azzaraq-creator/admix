"use client";

import { useRouter } from "next/navigation";

import { InquiryDetailPage } from "../../../_components/InquiryDetailPage";

export function InquiryDetailView({ id }: { id: string }) {
  const router = useRouter();
  return (
    <InquiryDetailPage
      id={id}
      onBack={() => router.push("/contact?tab=history")}
    />
  );
}
