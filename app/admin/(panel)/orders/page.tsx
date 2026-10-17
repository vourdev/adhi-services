import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Empty,
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
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/lib/domain";
import { formatDateTime, formatRupiah } from "@/lib/format";
import { adminContext, ownerPayments } from "@/server/admin";
import { listOrders } from "@/server/checkout";

import { PageHeader } from "../../_components/page-header";
import { Pager } from "../../_components/pager";
import { OrderActions } from "./_components/order-actions";
import { OrdersFilter } from "./_components/orders-filter";

export const metadata: Metadata = { title: "Orders" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  paid: "bg-success/10 text-success",
  pending: "bg-warning/15 text-foreground",
  failed: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
  refunded: "bg-muted text-muted-foreground",
};

export default async function OrdersPage({
  searchParams,
}: Props): Promise<ReactNode> {
  const { db, profileId } = await adminContext();
  const params = await searchParams;
  const status = ORDER_STATUSES.find((value) => value === params.status);
  const q = typeof params.q === "string" ? params.q : "";
  const page = Number(typeof params.page === "string" ? params.page : 1) || 1;
  const list = await listOrders(db, profileId, { status, query: q, page });
  const payments = ownerPayments();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Orders"
        description="Pesanan dari checkout langsung. Status lunas hanya berasal dari verifikasi server (webhook Midtrans + Status API)."
      />
      {payments.status.ready ? (
        <p className="text-xs text-muted-foreground">
          Midtrans, mode{" "}
          {payments.status.mode === "production"
            ? "production"
            : "sandbox (uji coba)"}
          .
        </p>
      ) : (
        <p className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Belum ada pesanan baru yang bisa dibuat. {payments.problem}
        </p>
      )}
      <OrdersFilter q={q} status={status ?? ""} />

      {list.rows.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ReceiptText />
            </EmptyMedia>
            <EmptyTitle>
              {q || status
                ? "Tidak ada pesanan yang cocok"
                : "Belum ada pesanan"}
            </EmptyTitle>
            <EmptyDescription>
              Pesanan muncul di sini saat pembeli memulai pembayaran di produk
              dengan checkout langsung.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pesanan</TableHead>
                <TableHead>Pembeli</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Unduhan</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.rows.map(
                ({
                  order,
                  productName,
                  paymentType,
                  downloadCount,
                  maxDownloads,
                }) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <div className="font-mono text-sm font-medium">
                        {order.code}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(order.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[12rem] truncate">
                        {order.buyerName}
                      </div>
                      <div className="max-w-[12rem] truncate text-xs text-muted-foreground">
                        {order.buyerEmail}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate">
                      {productName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRupiah(order.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLE[order.status]}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                      {paymentType ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {paymentType.replace(/_/g, " ")}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {downloadCount !== null && maxDownloads !== null
                        ? `${downloadCount}/${maxDownloads}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <OrderActions
                        orderId={order.id}
                        code={order.code}
                        pending={order.status === "pending"}
                      />
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </Card>
      )}
      <Pager
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        basePath="/admin/orders"
        params={Object.fromEntries(
          Object.entries({ q, status: status ?? "" }).filter(
            ([, value]) => value
          )
        )}
      />
    </div>
  );
}
