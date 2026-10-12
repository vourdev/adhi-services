"use client";

import {
  Check,
  Crown,
  ExternalLink,
  KeyRound,
  MoreVertical,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { UserPlan } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { premiumEndDate } from "@/lib/plan";
import type { MemberSummary } from "@/server/super-admin";

import {
  createMemberAction,
  resetMemberPasswordAction,
  setMemberPlanAction,
  setMemberStatusAction,
} from "@/app/admin/_actions/super-admin";

export function MembersClient({ members }: { members: MemberSummary[] }) {
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<"all" | "free" | "premium">(
    "all"
  );

  // Dialog States
  const [createOpen, setCreateOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberSummary | null>(
    null
  );

  // Form States
  const [isPending, startTransition] = useTransition();
  const [createPlan, setCreatePlan] = useState<UserPlan>("premium");
  const [nextPlan, setNextPlan] = useState<UserPlan>("premium");
  const [nextDuration, setNextDuration] = useState("365");

  const filtered = members.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      (m.profile?.username &&
        m.profile.username.toLowerCase().includes(search.toLowerCase()));

    const matchPlan =
      filterPlan === "all" ? true : m.effectivePlan === filterPlan;

    return matchSearch && matchPlan;
  });

  // Action Handlers
  async function handleCreateMember(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createMemberAction(formData);
      if (res.ok) {
        toast.success(`Member @${res.username} berhasil ditambahkan.`);
        setCreateOpen(false);
      } else {
        toast.error(res.error || "Gagal membuat member.");
      }
    });
  }

  async function handleUpdatePlan(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedMember) return;
    const formData = new FormData(e.currentTarget);
    formData.append("userId", selectedMember.id);
    startTransition(async () => {
      const res = await setMemberPlanAction(formData);
      if (res.ok) {
        toast.success(
          `Paket untuk ${selectedMember.name} berhasil diperbarui.`
        );
        setPlanDialogOpen(false);
      } else {
        toast.error(res.error || "Gagal memperbarui paket.");
      }
    });
  }

  async function handleResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedMember) return;
    const formData = new FormData(e.currentTarget);
    formData.append("userId", selectedMember.id);
    startTransition(async () => {
      const res = await resetMemberPasswordAction(formData);
      if (res.ok) {
        toast.success(`Password untuk ${selectedMember.name} berhasil diubah.`);
        setPwdDialogOpen(false);
      } else {
        toast.error(res.error || "Gagal mengubah password.");
      }
    });
  }

  function handleToggleStatus(m: MemberSummary) {
    const nextStatus = m.status === "active" ? "suspended" : "active";
    const label = nextStatus === "active" ? "diaktifkan" : "ditangguhkan";
    const formData = new FormData();
    formData.append("userId", m.id);
    formData.append("status", nextStatus);

    startTransition(async () => {
      const res = await setMemberStatusAction(formData);
      if (res.ok) {
        toast.success(`Akun ${m.name} berhasil ${label}.`);
      } else {
        toast.error(res.error || "Gagal mengubah status akun.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-sm min-w-0">
            <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari nama, email, atau username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <NativeSelect
            value={filterPlan}
            onChange={(e) =>
              setFilterPlan(e.target.value as "all" | "free" | "premium")
            }
            className="w-36 shrink-0 text-sm"
          >
            <option value="all">Semua Paket</option>
            <option value="premium">Premium Saja</option>
            <option value="free">Free Saja</option>
          </NativeSelect>
        </div>

        <Button
          onClick={() => {
            setCreatePlan("premium");
            setCreateOpen(true);
          }}
          className="shrink-0"
        >
          <Plus className="mr-1.5 size-4" />
          Tambah Member Baru
        </Button>
      </div>

      {/* Members Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Pengguna</th>
                <th className="px-4 py-3">Username & Profil</th>
                <th className="px-4 py-3">Peran (Role)</th>
                <th className="px-4 py-3">Paket (Plan)</th>
                <th className="px-4 py-3">Status</th>
                <th className="sticky right-0 bg-[color-mix(in_srgb,var(--muted)_40%,var(--card))] px-4 py-3 text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Tidak ada member yang sesuai pencarian.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const isSuper = m.role === "super_admin";
                  const isPremium = m.effectivePlan === "premium";
                  const isSuspended = m.status === "suspended";

                  return (
                    <tr
                      key={m.id}
                      className={`group transition-colors hover:bg-muted/30 ${
                        isSuspended ? "opacity-60" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-foreground">
                          {m.name}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {m.email}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {m.profile ? (
                          <Link
                            href={`/${m.profile.username}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            @{m.profile.username}
                            <ExternalLink className="size-3 opacity-70" />
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Belum ada profil
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isSuper ? (
                          <Badge>
                            <ShieldCheck />
                            Super Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline">Member</Badge>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isPremium ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1 font-semibold text-warning">
                              <Crown className="size-3.5" />
                              Premium
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {isSuper
                                ? "Bawaan Super Admin"
                                : m.planExpiresAt
                                  ? `s.d. ${formatDate(m.planExpiresAt)}`
                                  : "Tanpa batas waktu"}
                            </span>
                            {m.planNotes ? (
                              <span className="max-w-48 truncate text-[11px] text-muted-foreground italic">
                                ({m.planNotes})
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">
                              Free
                            </span>
                            {m.planExpired && m.planExpiresAt ? (
                              <span className="text-[11px] text-muted-foreground">
                                Premium berakhir {formatDate(m.planExpiresAt)}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {isSuspended ? (
                          <Badge variant="destructive">
                            <ShieldAlert />
                            Ditangguhkan
                          </Badge>
                        ) : (
                          <Badge className="bg-success/10 text-success">
                            <Check />
                            Aktif
                          </Badge>
                        )}
                      </td>

                      {/* Pinned to the right edge so the menu stays reachable when the table scrolls on a phone. */}
                      <td className="sticky right-0 bg-card px-4 py-3.5 text-right transition-colors group-hover:bg-[color-mix(in_srgb,var(--muted)_30%,var(--card))]">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>Aksi Member</DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            {/* The super admin always has premium, so there is no plan to set. */}
                            {!isSuper && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedMember(m);
                                  setNextPlan(m.effectivePlan);
                                  setNextDuration("365");
                                  setPlanDialogOpen(true);
                                }}
                              >
                                <Crown className="mr-2 size-4 text-warning" />
                                Atur / Upgrade Paket
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedMember(m);
                                setPwdDialogOpen(true);
                              }}
                            >
                              <KeyRound className="mr-2 size-4" />
                              Reset Password
                            </DropdownMenuItem>

                            {!isSuper && (
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(m)}
                                className={
                                  isSuspended
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                                }
                              >
                                {isSuspended ? (
                                  <>
                                    <UserCheck className="mr-2 size-4" />
                                    Aktifkan Akun
                                  </>
                                ) : (
                                  <>
                                    <UserX className="mr-2 size-4" />
                                    Tangguhkan Akun
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog: Tambah Member Baru */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Member Baru</DialogTitle>
            <DialogDescription>
              Buat akun kreator baru secara langsung dan tetapkan status
              keanggotaannya.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateMember} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="create-name">Nama Lengkap</Label>
              <Input
                id="create-name"
                name="name"
                required
                placeholder="Contoh: Budi Santoso"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-email">Alamat Email</Label>
              <Input
                id="create-email"
                name="email"
                type="email"
                required
                placeholder="budi@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-username">Username Profil</Label>
              <div className="flex items-center rounded-md border bg-muted/20 px-3">
                <span className="text-xs text-muted-foreground">@</span>
                <input
                  id="create-username"
                  name="username"
                  required
                  placeholder="budisantoso"
                  className="w-full bg-transparent p-2 text-sm outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-pwd">Password Awal</Label>
              <Input
                id="create-pwd"
                name="password"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                placeholder="Minimal 10 karakter, huruf dan angka"
              />
            </div>

            <div
              className={`grid gap-3 ${createPlan === "premium" ? "grid-cols-2" : "grid-cols-1"}`}
            >
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="create-plan">Paket</Label>
                <NativeSelect
                  id="create-plan"
                  name="plan"
                  className="w-full"
                  value={createPlan}
                  onChange={(e) => setCreatePlan(e.target.value as UserPlan)}
                >
                  <option value="premium">Premium</option>
                  <option value="free">Free</option>
                </NativeSelect>
              </div>

              {createPlan === "premium" ? (
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="create-duration">Durasi Premium</Label>
                  <NativeSelect
                    id="create-duration"
                    name="durationDays"
                    className="w-full"
                    defaultValue="365"
                  >
                    <option value="30">1 bulan</option>
                    <option value="90">3 bulan</option>
                    <option value="180">6 bulan</option>
                    <option value="365">1 tahun</option>
                    <option value="">Tanpa batas waktu</option>
                  </NativeSelect>
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-notes">Catatan Admin (Opsional)</Label>
              <Input
                id="create-notes"
                name="notes"
                placeholder="Contoh: Klien Jasa Pembuatan Website Paket Gold"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Menyimpan..." : "Buat Akun Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Atur / Upgrade Paket Member */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atur Paket Keanggotaan</DialogTitle>
            <DialogDescription>
              Ubah paket untuk{" "}
              <span className="font-semibold">{selectedMember?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdatePlan} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="update-plan">Paket</Label>
              <NativeSelect
                id="update-plan"
                name="plan"
                className="w-full"
                value={nextPlan}
                onChange={(e) => setNextPlan(e.target.value as UserPlan)}
              >
                <option value="premium">Premium</option>
                <option value="free">Free</option>
              </NativeSelect>
            </div>

            {nextPlan === "premium" ? (
              <div className="space-y-1.5">
                <Label htmlFor="update-duration">Tambah masa aktif</Label>
                <NativeSelect
                  id="update-duration"
                  name="durationDays"
                  className="w-full"
                  value={nextDuration}
                  onChange={(e) => setNextDuration(e.target.value)}
                >
                  <option value="30">1 bulan</option>
                  <option value="90">3 bulan</option>
                  <option value="180">6 bulan</option>
                  <option value="365">1 tahun</option>
                  <option value="">Tanpa batas waktu</option>
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  {planResultLabel(selectedMember, nextDuration)}
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="update-notes">Catatan Alasan / Keterangan</Label>
              <Input
                id="update-notes"
                name="notes"
                defaultValue={selectedMember?.planNotes ?? ""}
                placeholder="Contoh: Perpanjangan via WhatsApp / Klien Prioritas"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPlanDialogOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Menyimpan..." : "Simpan Perubahan Paket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reset Password Member */}
      <Dialog open={pwdDialogOpen} onOpenChange={setPwdDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password Member</DialogTitle>
            <DialogDescription>
              Setel password baru untuk{" "}
              <span className="font-semibold">{selectedMember?.name}</span>.
              Semua sesi login aktif milik pengguna ini akan dikeluarkan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-pwd">Password Baru</Label>
              <Input
                id="reset-pwd"
                name="newPassword"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                placeholder="Minimal 10 karakter, huruf dan angka"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPwdDialogOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Menyimpan..." : "Update Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** What the plan dialog will save, in words: a month added to an active premium extends it. */
function planResultLabel(
  member: MemberSummary | null,
  duration: string
): string {
  if (!member) return "";
  const end = premiumEndDate(
    { plan: member.effectivePlan, planExpiresAt: member.planExpiresAt },
    duration ? Number(duration) : null
  );
  if (!end) return "Premium aktif tanpa batas waktu.";
  return `Premium aktif sampai ${formatDate(end)}.`;
}
