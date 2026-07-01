"use client";

import { ErrorState } from "@/components/common/RouteStates";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState onRetry={reset} />;
}
