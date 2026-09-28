import type { ReactNode } from "react";

import { ClientShell } from "../(main)/_components/ClientShell";

export default function MypageLayout({ children }: { children: ReactNode }) {
  return <ClientShell>{children}</ClientShell>;
}
