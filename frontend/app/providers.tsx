"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toast } from "@heroui/react";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
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
              const status = (error as { response?: { status?: number } })
                ?.response?.status;
              return status === undefined || status >= 500;
            },
          },
        },
      }),
  );

  return (
    // 화면 모드(라이트·다크·시스템) — <html>에 light/dark 클래스를 붙이고 localStorage에 기억한다.
    // 바꾸는 순간 transition이 걸린 요소들이 천천히 바뀌지 않게 disableTransitionOnChange.
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={client}>
        {children}
        {/* 앱 알림(useSonner)은 HeroUI Toast — 위 가운데. */}
        <Toast.Provider placement="top" />
        {/* 기획안 담기 완료 — 왼쪽 아래 흰 카드. */}
        {/* TanStack Query 개발 도구 — 오른쪽 아래 떠 있는 버튼이 화면을 가려 기본은 끈다.
          필요하면 .env.local에 NEXT_PUBLIC_QUERY_DEVTOOLS=1을 넣고 dev 서버를 다시 띄운다. */}
        {process.env.NEXT_PUBLIC_QUERY_DEVTOOLS === "1" && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
