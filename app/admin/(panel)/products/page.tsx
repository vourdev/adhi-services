import { MessageCircle, Package, Plus, ShoppingCart } from "lucide-react";
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
import { parseRange } from "@/lib/analytics/range";
import {
  CHECKOUT_METHODS,
  PRODUCT_STATUSES,
  PRODUCT_TYPE_LABELS,
} from "@/lib/domain";
import { formatNumber, formatRupiah } from "@/lib/format";
import { adminContext, ownerPayments } from "@/server/admin";
import { getProductAnalytics } from "@/server/analytics/queries";
import {
  listProducts,
  PRODUCT_SORTS,
  type ProductSort,
} from "@/server/products";

import { PageHeader } from "../../_components/page-header";
import { Pager } from "../../_components/pager";
import { ProductsToolbar } from "./_components/products-toolbar";

export const metadata: Metadata = { title: "Products" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pick<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | undefined {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

export default async function ProductsPage({
  searchParams,
}: Props): Promise<ReactNode> {
  const { db, profileId } = await adminContext();
  const params = await searchParams;
  const status = pick(params.status, PRODUCT_STATUSES);
  const method = pick(params.method, CHECKOUT_METHODS);
  const sort = pick<ProductSort>(params.sort, PRODUCT_SORTS) ?? "updated";
  const filters = {
    q: typeof params.q === "string" ? params.q : "",
    status: status ?? "",
    method: method ?? "",
    sort,
  };
  const page = Number(typeof params.page === "string" ? params.page : 1) || 1;

  const [list, analytics] = await Promise.all([
    listProducts(db, profileId, {
      query: filters.q,
      status,
      method,
      sort,
      page,
    }),
    getProductAnalytics(db, profileId, parseRange({ range: "30d" })),
  ]);
  const stats = new Map(analytics.rows.map((row) => [row.productId, row]));
  const payments = ownerPayments();
  const filtered = Boolean(filters.q || filters.status || filters.method);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Products"
        description="Produk digital, template, dan jasa. Setiap produk punya cara pemesanan sendiri: WhatsApp atau checkout langsung."
        actions={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus />
              Produk baru
            </Link>
          </Button>
        }
      />
      {payments.problem ? (
        <p className="rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Checkout langsung belum aktif. {payments.problem} Produk WhatsApp
          tetap bisa dipublikasikan.
        </p>
      ) : null}
      <ProductsToolbar filters={filters} />

      {list.total === 0 && !filtered ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Package />
            </EmptyMedia>
            <EmptyTitle>Belum ada produk</EmptyTitle>
            <EmptyDescription>
              Tambahkan ebook, template, atau jasa. Produk bisa dipesan lewat
              WhatsApp atau dibayar langsung.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/admin/products/new">
                <Plus />
                Produk baru
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : list.rows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Tidak ada produk yang cocok dengan filter.
        </p>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead className="text-right">Harga</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pemesanan</TableHead>
                <TableHead className="text-right">Tayangan 30h</TableHead>
                <TableHead className="text-right">Hasil 30h</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((product) => {
                const row = stats.get(product.id);
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="flex items-center gap-3"
                      >
                        <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                          {product.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- owner-supplied cover
                            <img
                              src={product.coverUrl}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <Package
                              className="size-4 text-muted-foreground"
                              aria-hidden
                            />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block max-w-[16rem] truncate font-medium hover:underline">
                            {product.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {PRODUCT_TYPE_LABELS[product.productType]}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRupiah(product.priceAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.status === "published"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {product.status === "published" ? "Tayang" : "Draf"}
                      </Badge>
                      {product.isFeatured ? (
                        <Badge variant="outline" className="ml-1">
                          Unggulan
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        {product.checkoutMethod === "whatsapp" ? (
                          <MessageCircle className="size-4" aria-hidden />
                        ) : (
                          <ShoppingCart className="size-4" aria-hidden />
                        )}
                        {product.checkoutMethod === "whatsapp"
                          ? "WhatsApp"
                          : "Checkout langsung"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row?.views ?? 0)}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {product.checkoutMethod === "whatsapp"
                        ? `${formatNumber(row?.whatsappClicks ?? 0)} klik WA`
                        : `${formatNumber(row?.paidOrders ?? 0)} lunas · ${formatRupiah(row?.revenue ?? 0)}`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      <Pager
        page={list.page}
        pageCount={list.pageCount}
        total={list.total}
        basePath="/admin/products"
        params={Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value)
        )}
      />
    </div>
  );
}
