import type { Metadata } from "next";
import type { ReactNode } from "react";

import { superAdminContext } from "@/server/admin";
import { listMembers } from "@/server/super-admin";

import { PageHeader } from "../../../_components/page-header";
import { MembersClient } from "./members-client";

export const metadata: Metadata = { title: "Kelola Member & Premium" };

export default async function SuperAdminMembersPage(): Promise<ReactNode> {
  const { db } = await superAdminContext();
  const members = await listMembers(db);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kelola Member & Aktivasi Premium"
        description="Kelola akun pengguna dan aktifkan keanggotaan Premium secara instan"
      />

      <MembersClient members={members} />
    </div>
  );
}
