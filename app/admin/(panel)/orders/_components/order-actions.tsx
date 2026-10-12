"use client";

import { EllipsisVertical, KeyRound, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import {
  refreshOrderAction,
  rotateOrderAccessAction,
} from "../../../_actions/orders";
import { CopyButton } from "../../../_components/copy-button";

export function OrderActions({
  orderId,
  code,
  pending: isPending,
}: {
  orderId: string;
  code: string;
  pending: boolean;
}): ReactNode {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  function refresh() {
    startTransition(async () => {
      const result = await refreshOrderAction(orderId);
      if (!result.ok) toast.error(result.error);
      else toast.success(`Status: ${result.data.status}`);
      router.refresh();
    });
  }

  function rotate() {
    startTransition(async () => {
      const result = await rotateOrderAccessAction(orderId);
      if (!result.ok) toast.error(result.error);
      else setLink(result.data.url);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Aksi pesanan ${code}`}
            disabled={busy}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isPending ? (
            <DropdownMenuItem onSelect={refresh}>
              <RefreshCw />
              Cek status di Midtrans
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={rotate}>
            <KeyRound />
            Buat link pembeli baru
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={link !== null}
        onOpenChange={(open) => !open && setLink(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link pesanan {code}</DialogTitle>
            <DialogDescription>
              Kirim ke pembeli. Link lama tidak berlaku lagi. Link ini hanya
              ditampilkan sekali, jadi salin sekarang.
            </DialogDescription>
          </DialogHeader>
          <Input
            readOnly
            value={link ?? ""}
            onFocus={(event) => event.currentTarget.select()}
            aria-label="Link pesanan"
          />
          <DialogFooter>
            {link ? (
              <CopyButton
                value={link}
                label="Salin link"
                variant="default"
                size="default"
              />
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
