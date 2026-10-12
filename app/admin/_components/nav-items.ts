import {
  ChartColumn,
  LayoutDashboard,
  Link2,
  type LucideIcon,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sliders,
  TicketPercent,
  UserRound,
  Users,
} from "lucide-react";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  description: string;
};

export const SUPER_ADMIN_GROUP: { label: string; items: NavItem[] } = {
  label: "Super Admin",
  items: [
    {
      title: "Master Control",
      url: "/admin/super",
      icon: ShieldCheck,
      description: "Ringkasan sistem dan performa SaaS",
    },
    {
      title: "Kelola Member",
      url: "/admin/super/members",
      icon: Users,
      description: "Daftar pengguna & aktivasi premium",
    },
    {
      title: "Brand Platform",
      url: "/admin/super/settings",
      icon: Sliders,
      description: "Nama brand & identitas platform",
    },
  ],
};

export function getNavGroups(
  role?: string
): Array<{ label: string; items: NavItem[] }> {
  if (role === "super_admin") {
    return [SUPER_ADMIN_GROUP, ...NAV_GROUPS];
  }
  return NAV_GROUPS;
}

export const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Performa",
    items: [
      {
        title: "Overview",
        url: "/admin",
        icon: LayoutDashboard,
        description: "Ringkasan kunjungan dan klik",
      },
      {
        title: "Analytics",
        url: "/admin/analytics",
        icon: ChartColumn,
        description: "Sumber traffic, link, dan produk",
      },
    ],
  },
  {
    label: "Konten",
    items: [
      {
        title: "Links",
        url: "/admin/links",
        icon: Link2,
        description: "Link dan urutan di profil",
      },
      {
        title: "Products",
        url: "/admin/products",
        icon: Package,
        description: "Katalog dan checkout",
      },
      {
        title: "Discounts",
        url: "/admin/discounts",
        icon: TicketPercent,
        description: "Kode diskon untuk pembeli",
      },
      {
        title: "Orders",
        url: "/admin/orders",
        icon: ReceiptText,
        description: "Pesanan checkout langsung",
      },
    ],
  },
  {
    label: "Akun",
    items: [
      {
        title: "Profile",
        url: "/admin/profile",
        icon: UserRound,
        description: "Foto, bio, media sosial, tampilan",
      },
      {
        title: "Settings",
        url: "/admin/settings",
        icon: Settings,
        description: "URL publik, WhatsApp, keamanan",
      },
    ],
  },
];

/** True when `pathname` is the item's page or one of its subpages. */
export function matchesNavItem(pathname: string, url: string): boolean {
  return url === "/admin"
    ? pathname === "/admin"
    : pathname === url || pathname.startsWith(`${url}/`);
}

/**
 * The one item to highlight: the most specific match, so a page such as
 * /admin/super/members highlights "Kelola Member" and not also its parent
 * "Master Control".
 */
export function activeNavItem(
  pathname: string,
  items: NavItem[]
): NavItem | undefined {
  let best: NavItem | undefined;
  for (const item of items) {
    if (
      matchesNavItem(pathname, item.url) &&
      item.url.length > (best?.url.length ?? -1)
    )
      best = item;
  }
  return best;
}

export function currentNavItem(pathname: string): NavItem | undefined {
  return activeNavItem(
    pathname,
    [SUPER_ADMIN_GROUP, ...NAV_GROUPS].flatMap((group) => group.items)
  );
}
