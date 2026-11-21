"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, ClipboardList, History, LogOut, Package, PlusCircle, Receipt, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getApi } from "@/lib/data";
import { cx } from "./primitives";

const NAV = [
  { href: "/", label: "Nueva venta", short: "Vender", icon: PlusCircle, admin: false, mobile: true },
  { href: "/ventas", label: "Ventas", short: "Ventas", icon: Receipt, admin: false, mobile: true },
  { href: "/cierre", label: "Cierre del día", short: "Cierre", icon: ClipboardList, admin: true, mobile: true },
  { href: "/actividad", label: "Actividad", short: "Actividad", icon: History, admin: true, mobile: true },
  { href: "/reportes", label: "Reportes", short: "Reportes", icon: BarChart3, admin: true, mobile: true },
  { href: "/productos", label: "Productos", short: "Prod.", icon: Package, admin: true, mobile: false },
  { href: "/equipo", label: "Equipo", short: "Equipo", icon: Users, admin: true, mobile: false },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, isAdmin } = useAuth();
  const items = NAV.filter((n) => isAdmin || !n.admin);
  const demo = getApi().mode === "demo";

  const logout = async () => {
    await getApi().signOut();
    router.replace("/login");
  };


  return (
    <div className="min-h-dvh md:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-60 shrink-0 flex-col border-r border-line bg-surface/60 sticky top-0 h-dvh">
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold">B</div>
          <div className="leading-tight">
            <p className="font-semibold">Barra</p>
            <p className="text-xs text-muted-foreground">Registro de ventas</p>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {items.map((n) => {
            const active = pathname === n.href;
            const divider = isAdmin && n.href === "/productos";
            return (
              <div key={n.href}>
                {divider && <p className="px-3 pt-4 pb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Administración</p>}
                <Link
                  href={n.href}
                  className={cx(
                    "flex items-center gap-3 rounded-lg px-3 h-10 text-sm transition-colors",
                    active ? "bg-primary/12 text-ink" : "text-ink-2 hover:text-ink hover:bg-surface-2/60",
                  )}
                >
                  <n.icon size={18} className={active ? "text-primary" : ""} />
                  {n.label}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="p-3 border-t border-line">
          {demo && <p className="mb-2 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs text-primary">Modo demo · datos solo en este navegador</p>}
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="min-w-0">
              <p className="text-sm truncate">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">{isAdmin ? "Administrador" : "Personal"}</p>
            </div>
            <button onClick={logout} className="text-muted-foreground hover:text-ink p-2" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-sm font-bold">B</div>
          <span className="font-semibold">Barra</span>
          {demo && <span className="text-[11px] text-primary border border-primary/30 rounded px-1.5">demo</span>}
        </div>
        <div className="flex items-center">
          {items
            .filter((n) => !n.mobile)
            .map((n) => (
              <Link key={n.href} href={n.href} className={cx("p-2", pathname === n.href ? "text-primary" : "text-muted-foreground hover:text-ink")} aria-label={n.label}>
                <n.icon size={18} />
              </Link>
            ))}
          <button onClick={logout} className="text-muted-foreground hover:text-ink p-2" aria-label="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 min-w-0 px-4 md:px-8 py-5 md:py-7 pb-24 md:pb-8">{children}</main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-bg/95 backdrop-blur flex">
        {items
          .filter((n) => n.mobile)
          .map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cx("relative flex-1 flex flex-col items-center justify-center gap-0.5 h-16 text-[11px]", active ? "text-primary" : "text-muted-foreground")}
              >
                <n.icon size={20} />
                {n.short}
              </Link>
            );
          })}
      </nav>
    </div>
  );
}
