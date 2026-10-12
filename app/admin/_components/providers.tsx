"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider, useTheme } from "next-themes";
import { type ReactNode, useEffect } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Sidebar colours (shadcn --sidebar) as hex, because theme-color support for oklch() varies. */
const SIDEBAR_COLOR = { light: "#fafafa", dark: "#171717" } as const;

/**
 * Keeps the browser's theme-color (Safari's top bar and overscroll tint) on
 * the dashboard theme when it is chosen manually instead of following the
 * system. Re-applied after navigation, which re-renders the head.
 */
function ThemeColorSync(): null {
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();
  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    const color = SIDEBAR_COLOR[resolvedTheme];
    for (const meta of document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]'
    )) {
      meta.content = color;
    }
  }, [resolvedTheme, pathname]);
  return null;
}

export function AdminProviders({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeColorSync />
      <TooltipProvider>
        {children}
        <Toaster position="top-center" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
