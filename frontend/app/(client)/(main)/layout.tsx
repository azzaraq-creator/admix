import type { ReactNode } from "react";

import { ClientShell } from "./_components/ClientShell";

export default function ClientMainLayout({ children }: { children: ReactNode }) {
  return <ClientShell>{children}</ClientShell>;
}
