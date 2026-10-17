import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { CSSProperties, ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireOwner } from "@/server/session";

import { AdminHeader } from "../_components/admin-header";
import { AppSidebar } from "../_components/app-sidebar";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Dashboard" },
  robots: { index: false, follow: false },
};

/** Browser chrome (e.g. Safari's top bar) in the sidebar colour; ThemeColorSync follows a manual theme choice. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};

/** Shared shell for every admin page. The session is verified here and again in every action. */
export default async function PanelLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactNode> {
  const owner = await requireOwner();
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        { "--sidebar-width": "calc(var(--spacing) * 64)" } as CSSProperties
      }
    >
      <AppSidebar
        owner={{
          name: owner.profile.displayName,
          email: owner.user.email,
          username: owner.profile.username,
        }}
      />
      <SidebarInset className="min-w-0 overflow-x-clip">
        <AdminHeader username={owner.profile.username} />
        <div className="min-h-0 min-w-0 flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
