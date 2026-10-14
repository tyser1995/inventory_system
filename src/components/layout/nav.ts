import { ArrowLeftRight, Boxes, LayoutDashboard, ScrollText, Settings, Tags, Truck, type LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown if the user has any of these (none = everyone). */
  perms?: Permission[];
}

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, perms: ["dashboard.view"] },
  { href: "/products", label: "Products", icon: Boxes, perms: ["products.view"] },
  { href: "/movements", label: "Stock Movements", icon: ArrowLeftRight, perms: ["movements.view"] },
  { href: "/categories", label: "Categories", icon: Tags, perms: ["categories.view", "categories.manage"] },
  { href: "/suppliers", label: "Suppliers", icon: Truck, perms: ["suppliers.view", "suppliers.manage"] },
  { href: "/logs", label: "Logs", icon: ScrollText, perms: ["logs.view"] },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
