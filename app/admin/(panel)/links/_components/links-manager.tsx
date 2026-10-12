"use client";

import {
  ArrowDown,
  ArrowUp,
  ChartColumn,
  EllipsisVertical,
  ExternalLink,
  Heading,
  Link2,
  MessageCircle,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useMemo,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { formatNumber, formatPercent } from "@/lib/format";

import {
  addProductBlockAction,
  deleteLinkAction,
  reorderLinksAction,
  toggleLinkAction,
} from "../../../_actions/links";
import { CopyButton } from "../../../_components/copy-button";
import { type EditableLink, LinkFormDialog } from "./link-form-dialog";

export type ManagedLink = {
  id: string;
  kind: "link" | "heading" | "product" | "whatsapp";
  title: string | null;
  url: string | null;
  message: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  category: string | null;
  layout: "classic" | "featured";
  isActive: boolean;
  product: {
    id: string;
    name: string;
    status: "draft" | "published";
    coverUrl: string | null;
  } | null;
  clicks: number;
  ctr: number | null;
};

type Props = {
  links: ManagedLink[];
  products: Array<{ id: string; name: string; status: "draft" | "published" }>;
  /** False while Settings has no WhatsApp number: WhatsApp links stay hidden on the profile. */
  whatsappReady: boolean;
  publicUrl: string;
  rangeLabel: string;
  rangeQuery: string;
};

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

export function LinksManager({
  links,
  products,
  whatsappReady,
  publicUrl,
  rangeLabel,
  rangeQuery,
}: Props): ReactNode {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, applyOptimistic] = useOptimistic(
    links,
    (_state, next: ManagedLink[]) => next
  );
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{
    open: boolean;
    link: EditableLink | null;
    kind: "link" | "heading" | "whatsapp";
  }>({
    open: false,
    link: null,
    kind: "link",
  });
  const [toDelete, setToDelete] = useState<ManagedLink | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return optimistic;
    return optimistic.filter((link) =>
      [
        link.title,
        link.url,
        link.message,
        link.description,
        link.category,
        link.product?.name,
      ].some((value) => value?.toLowerCase().includes(term))
    );
  }, [optimistic, query]);

  const productsOnProfile = new Set(
    optimistic.flatMap((link) => (link.product ? [link.product.id] : []))
  );
  const addableProducts = products.filter(
    (product) => !productsOnProfile.has(product.id)
  );

  function refresh() {
    router.refresh();
  }

  function reorder(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= optimistic.length) return;
    const next = move(optimistic, index, target);
    startTransition(async () => {
      applyOptimistic(next);
      const result = await reorderLinksAction(next.map((link) => link.id));
      if (!result.ok) toast.error(result.error);
      refresh();
    });
  }

  function toggle(link: ManagedLink, isActive: boolean) {
    startTransition(async () => {
      applyOptimistic(
        optimistic.map((item) =>
          item.id === link.id ? { ...item, isActive } : item
        )
      );
      const result = await toggleLinkAction(link.id, isActive);
      if (!result.ok) toast.error(result.error);
      else
        toast.success(
          isActive ? "Ditampilkan di profil" : "Disembunyikan dari profil"
        );
      refresh();
    });
  }

  function confirmDelete() {
    const link = toDelete;
    if (!link) return;
    setToDelete(null);
    startTransition(async () => {
      applyOptimistic(optimistic.filter((item) => item.id !== link.id));
      const result = await deleteLinkAction(link.id);
      if (!result.ok) toast.error(result.error);
      else
        toast.success(
          "Dihapus. Klik yang sudah tercatat tetap ada di statistik."
        );
      refresh();
    });
  }

  function addProduct(productId: string) {
    startTransition(async () => {
      const result = await addProductBlockAction({ productId });
      if (!result.ok) toast.error(result.error);
      else toast.success("Produk ditambahkan ke profil");
      refresh();
    });
  }

  function openEdit(link: ManagedLink) {
    if (link.kind === "product") return;
    setDialog({
      open: true,
      kind: link.kind,
      link: {
        id: link.id,
        kind: link.kind,
        title: link.title ?? "",
        url: link.url ?? "",
        message: link.message ?? "",
        description: link.description ?? "",
        thumbnailUrl: link.thumbnailUrl ?? "",
        category: link.category ?? "",
        layout: link.layout,
        isActive: link.isActive,
      },
    });
  }

  const addMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus />
          Tambah
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem
          onSelect={() => setDialog({ open: true, link: null, kind: "link" })}
        >
          <Link2 />
          Link
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            setDialog({ open: true, link: null, kind: "whatsapp" })
          }
        >
          <MessageCircle />
          Link WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            setDialog({ open: true, link: null, kind: "heading" })
          }
        >
          <Heading />
          Judul bagian
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Kartu produk
        </DropdownMenuLabel>
        {addableProducts.length === 0 ? (
          <DropdownMenuItem asChild>
            <Link href="/admin/products/new">
              <Package />
              {products.length === 0
                ? "Buat produk dulu"
                : "Semua produk sudah ditampilkan"}
            </Link>
          </DropdownMenuItem>
        ) : (
          addableProducts.map((product) => (
            <DropdownMenuItem
              key={product.id}
              onSelect={() => addProduct(product.id)}
            >
              <Package />
              <span className="truncate">{product.name}</span>
              {product.status === "draft" ? (
                <Badge variant="secondary">draf</Badge>
              ) : null}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="sm:max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Cari link..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Cari link"
          />
        </InputGroup>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton value={publicUrl} label="Salin URL profil" />
          {addMenu}
        </div>
      </div>

      {optimistic.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Link2 />
            </EmptyMedia>
            <EmptyTitle>Belum ada link</EmptyTitle>
            <EmptyDescription>
              Tambahkan link pertama, misalnya portfolio, katalog, atau kontak
              WhatsApp.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>{addMenu}</EmptyContent>
        </Empty>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Tidak ada link yang cocok dengan &quot;{query}&quot;.
        </p>
      ) : (
        <Card className="gap-0 py-0">
          <ol className="divide-y">
            {filtered.map((link) => {
              const index = optimistic.findIndex((item) => item.id === link.id);
              const title =
                link.kind === "product"
                  ? (link.product?.name ?? "Produk")
                  : (link.title ?? "");
              const hiddenReason = !link.isActive
                ? "Disembunyikan"
                : link.kind === "product" && link.product?.status === "draft"
                  ? "Produk masih draf"
                  : link.kind === "whatsapp" && !whatsappReady
                    ? "Nomor WhatsApp belum diatur"
                    : null;
              const tracked = link.kind === "link" || link.kind === "whatsapp";
              return (
                <li
                  key={link.id}
                  className="flex items-center gap-3 px-3 py-3 sm:px-4"
                >
                  <div className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Naikkan ${title}`}
                      disabled={index <= 0 || query !== ""}
                      onClick={() => reorder(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Turunkan ${title}`}
                      disabled={index === optimistic.length - 1 || query !== ""}
                      onClick={() => reorder(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                  </div>

                  <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                    {link.kind === "heading" ? (
                      <Heading className="size-4" aria-hidden />
                    ) : (link.thumbnailUrl ?? link.product?.coverUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- owner-supplied thumbnail
                      <img
                        src={
                          (link.thumbnailUrl ??
                            link.product?.coverUrl) as string
                        }
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : link.kind === "product" ? (
                      <Package className="size-4" aria-hidden />
                    ) : link.kind === "whatsapp" ? (
                      <MessageCircle className="size-4" aria-hidden />
                    ) : (
                      <Link2 className="size-4" aria-hidden />
                    )}
                  </div>

                  <div
                    className={`min-w-0 flex-1 ${link.isActive ? "" : "opacity-60"}`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`truncate font-medium ${link.kind === "heading" ? "text-xs tracking-wide uppercase" : "text-sm"}`}
                      >
                        {title}
                      </span>
                      {link.kind === "product" ? (
                        <Badge variant="secondary">Produk</Badge>
                      ) : null}
                      {link.kind === "whatsapp" ? (
                        <Badge variant="secondary">WhatsApp</Badge>
                      ) : null}
                      {link.layout === "featured" && tracked ? (
                        <Badge variant="outline">Unggulan</Badge>
                      ) : null}
                      {hiddenReason ? (
                        <Badge variant="outline">{hiddenReason}</Badge>
                      ) : null}
                    </div>
                    {link.kind === "link" ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {link.url}
                      </p>
                    ) : link.kind === "whatsapp" ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {whatsappReady ? (
                          link.message
                        ) : (
                          <Link
                            href="/admin/settings"
                            className="underline underline-offset-2"
                          >
                            Isi nomor WhatsApp di Settings agar kartu ini tampil
                          </Link>
                        )}
                      </p>
                    ) : null}
                  </div>

                  {tracked ? (
                    <div className="hidden w-28 text-right text-xs tabular-nums sm:block">
                      <div className="font-medium text-foreground">
                        {formatNumber(link.clicks)} klik
                      </div>
                      <div className="text-muted-foreground">
                        CTR {formatPercent(link.ctr)}
                      </div>
                    </div>
                  ) : null}

                  <Switch
                    checked={link.isActive}
                    onCheckedChange={(checked) => toggle(link, checked)}
                    aria-label={`Tampilkan ${title} di profil`}
                  />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Aksi untuk ${title}`}
                      >
                        <EllipsisVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {link.kind === "product" && link.product ? (
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/products/${link.product.id}`}>
                            <Pencil />
                            Edit produk
                          </Link>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => openEdit(link)}>
                          <Pencil />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {tracked ? (
                        <>
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/admin/links/${link.id}?${rangeQuery}`}
                            >
                              <ChartColumn />
                              Statistik link
                            </Link>
                          </DropdownMenuItem>
                          {link.url ? (
                            <DropdownMenuItem asChild>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink />
                                Buka tujuan
                              </a>
                            </DropdownMenuItem>
                          ) : null}
                        </>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setToDelete(link)}
                      >
                        <Trash2 />
                        {link.kind === "product"
                          ? "Hapus dari profil"
                          : "Hapus"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Klik dan CTR: {rangeLabel.toLowerCase()}. Urutan di sini sama dengan
        urutan di profil.
        {query ? " Kosongkan pencarian untuk mengubah urutan." : ""}
      </p>

      <LinkFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((state) => ({ ...state, open }))}
        link={dialog.link}
        kind={dialog.kind}
        onSaved={refresh}
      />

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toDelete?.kind === "product"
                ? "Hapus kartu produk dari profil?"
                : `Hapus "${toDelete?.title ?? ""}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.kind === "product"
                ? "Produknya tetap ada di menu Products. Hanya kartunya yang hilang dari profil."
                : "Link langsung hilang dari profil. Klik yang sudah tercatat tetap dihitung di statistik."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
