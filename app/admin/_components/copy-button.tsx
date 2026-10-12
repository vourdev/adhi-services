"use client";

import { Check, Copy } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  label = "Salin",
  variant = "outline",
  size = "sm",
}: {
  value: string;
  label?: string;
  variant?: "outline" | "ghost" | "secondary" | "default";
  size?: "sm" | "default" | "icon" | "icon-sm";
}): ReactNode {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Disalin ke clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Gagal menyalin. Salin manual: " + value);
    }
  }

  const icon = copied ? <Check /> : <Copy />;
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={copy}
      aria-label={size.startsWith("icon") ? label : undefined}
    >
      {icon}
      {size.startsWith("icon") ? null : label}
    </Button>
  );
}
