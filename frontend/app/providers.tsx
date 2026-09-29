"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toast } from "@heroui/react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
            throwOnError: (error) => {
              const status = (
                error as { response?: { status?: number } }
              )?.response?.status;
              return status === undefined || status >= 500;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {/* 앱 알림(useSonner)은 HeroUI Toast — 위 가운데. */}
      <Toast.Provider placement="top" />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
