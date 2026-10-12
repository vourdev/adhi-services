import { Plus, TicketPercent } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DiscountCode } from "@/db/schema";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import { describeDiscount } from "@/lib/pricing";
import { adminContext } from "@/server/admin";
import {
  codeStatus,
  type CodeStatus,
  listDiscountCodes,
} from "@/server/discount-codes";

import { PageHeader } from "../../_components/page-header";

export const metadata: Metadata = { title: "Discounts" };

const STATUS: Record<
  CodeStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  active: { label: "Aktif", variant: "default" },
  scheduled: { label: "Terjadwal", variant: "outline" },
  inactive: { label: "Nonaktif", variant: "secondary" },
  ended: { label: "Berakhir", variant: "secondary" },
  used_up: { label: "Kuota habis", variant: "secondary" },
};

function validity(code: Pick<DiscountCode, "startsAt" | "endsAt">): string {
  if (code.startsAt && code.endsAt)
    return `${formatDate(code.startsAt)} s.d. ${formatDate(code.endsAt)}`;
  if (code.endsAt) return `s.d. ${formatDate(code.endsAt)}`;
  if (code.startsAt) return `mulai ${formatDate(code.startsAt)}`;
  return "Tanpa batas";
}

export default async function DiscountsPage(): Promise<ReactNode> {
  const { db, profileId } = await adminContext();
  const codes = await listDiscountCodes(db, profileId);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Discounts"
        description="Kode diskon yang bisa dimasukkan pembeli, misalnya 1010 untuk potongan 10% atau Rp10.000."
        actions={
          <Button asChild>
            <Link href="/admin/discounts/new">
              <Plus />
              Kode baru
            </Link>
          </Button>
        }
      />

      {codes.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TicketPercent />
            </EmptyMedia>
            <EmptyTitle>Belum ada kode diskon</EmptyTitle>
            <EmptyDescription>
              Buat kode berupa potongan persen atau nominal rupiah. Kolom kode
              diskon baru muncul di checkout setelah ada kode yang aktif.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/admin/discounts/new">
                <Plus />
                Kode baru
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Potongan</TableHead>
                <TableHead>Berlaku untuk</TableHead>
                <TableHead>Masa berlaku</TableHead>
                <TableHead className="text-right">Dipakai</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((code) => {
                const status = STATUS[codeStatus(code, code.paidUses)];
                return (
                  <TableRow key={code.id}>
                    <TableCell>
                      <Link
                        href={`/admin/discounts/${code.id}`}
                        className="font-mono font-semibold hover:underline"
                      >
                        {code.code}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {describeDiscount(code)}
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate">
                      {code.productName ?? "Semua produk"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {validity(code)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="block">
                        {formatNumber(code.paidUses)}
                        {code.maxUses !== null
                          ? ` / ${formatNumber(code.maxUses)}`
                          : ""}
                      </span>
                      {code.discountTotal > 0 ? (
                        <span className="block text-xs text-muted-foreground">
                          {formatRupiah(code.discountTotal)} potongan
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      {codes.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Dipakai = pesanan checkout langsung yang sudah lunas. Pesanan lewat
          WhatsApp tidak tercatat di sini.
        </p>
      ) : null}
    </div>
  );
}
