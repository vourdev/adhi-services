import type { Metadata } from "next";
import type { ReactNode } from "react";

import { superAdminContext } from "@/server/admin";
import { getPlatformSettings } from "@/server/super-admin";

import { PageHeader } from "../../../_components/page-header";
import { BrandClient } from "./brand-client";

export const metadata: Metadata = { title: "Pengaturan Brand Platform" };

export default async function SuperAdminSettingsPage(): Promise<ReactNode> {
  const { db } = await superAdminContext();
  const settings = await getPlatformSettings(db);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengaturan Brand Platform"
        description="Sesuaikan nama platform, identitas brand, dan teks watermark publik"
      />

      <BrandClient settings={settings} />
    </div>
  );
}
