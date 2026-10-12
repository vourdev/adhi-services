import type { ReactNode } from "react";

import { AdminProviders } from "./_components/providers";

/** Theme and toasts for every admin route, sign-in included, so they stay mounted across the login redirect. */
export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return <AdminProviders>{children}</AdminProviders>;
}
