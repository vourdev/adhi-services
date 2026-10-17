"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PlatformSettings } from "@/db/schema";

import { updatePlatformSettingsAction } from "@/app/admin/_actions/platform-settings";

export function BrandForm({ settings }: { settings: PlatformSettings }) {
  const [isPending, startTransition] = useTransition();
  const [brandName, setBrandName] = useState(settings.brandName);
  const [brandTagline, setBrandTagline] = useState(settings.brandTagline ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await updatePlatformSettingsAction(formData);
      if (res.ok) {
        toast.success("Brand dan kontak disimpan.");
      } else {
        toast.error(res.error || "Gagal menyimpan pengaturan.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Brand dan kontak usaha</CardTitle>
          <CardDescription>
            Nama brand tampil di footer halaman publik dan di email pesanan.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="brand-name">Nama brand</Label>
            <Input
              id="brand-name"
              name="brandName"
              required
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Contoh: Adhi Web Services"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brand-tagline">Tagline</Label>
            <Input
              id="brand-tagline"
              name="brandTagline"
              value={brandTagline}
              onChange={(e) => setBrandTagline(e.target.value)}
              placeholder="Satu link untuk segala profil dan produk Anda"
            />
          </div>

          <div className="space-y-4 border-t pt-4">
            <div>
              <p className="text-sm font-medium">Kontak usaha</p>
              <p className="text-xs text-muted-foreground">
                Tampil di halaman Kontak, Syarat & Ketentuan, Kebijakan Refund,
                dan FAQ. Kolom yang kosong tidak ditampilkan.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="business-name">Nama usaha</Label>
              <Input
                id="business-name"
                name="businessName"
                maxLength={100}
                defaultValue={settings.businessName ?? ""}
                placeholder="Nama usaha atau nama pemilik"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="contact-email">Email kontak</Label>
                <Input
                  id="contact-email"
                  name="contactEmail"
                  type="email"
                  defaultValue={settings.contactEmail ?? ""}
                  placeholder="nama@domain.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-phone">Nomor telepon</Label>
                <Input
                  id="contact-phone"
                  name="contactPhone"
                  type="tel"
                  inputMode="tel"
                  maxLength={30}
                  defaultValue={settings.contactPhone ?? ""}
                  placeholder="08xx xxxx xxxx"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="business-address">Alamat usaha</Label>
              <Textarea
                id="business-address"
                name="businessAddress"
                rows={3}
                maxLength={300}
                defaultValue={settings.businessAddress ?? ""}
                placeholder="Jalan, nomor, kelurahan, kecamatan, kota, kode pos"
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="border-t pt-4">
          <Button type="submit" disabled={isPending}>
            <Check className="mr-1.5 size-4" />
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
