"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, Clock, LogOut, Package, PlusCircle, Receipt, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getApi } from "@/lib/data";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "Nueva venta", short: "Vender", icon: PlusCircle, admin: false },
  { href: "/ventas", label: "Ventas", short: "Ventas", icon: Receipt, admin: false },
  { href: "/pendientes", label: "Pendientes", short: "Pend.", icon: Clock, admin: true },
  { href: "/cierre", label: "Cierre del día", short: "Cierre", icon: ClipboardList, admin: true },
  { href: "/productos", label: "Productos", short: "Prod.", icon: Package, admin: true },
  { href: "/equipo", label: "Equipo", short: "Equipo", icon: Users, admin: true },
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
          <div className="h-8 w-8 rounded-lg bg-accent text-accent-ink grid place-items-center font-bold">B</div>
          <div className="leading-tight">
            <p className="font-semibold">Barra</p>
            <p className="text-xs text-muted">Registro de ventas</p>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {items.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cx(
                  "flex items-center gap-3 rounded-lg px-3 h-10 text-sm transition-colors",
                  active ? "bg-surface-2 text-ink" : "text-ink-2 hover:text-ink hover:bg-surface-2/60",
                )}
              >
                <n.icon size={18} className={active ? "text-accent" : ""} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-line">
          {demo && <p className="mb-2 rounded-md bg-accent/10 px-2.5 py-1.5 text-xs text-accent">Modo demo · datos solo en este navegador</p>}
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="min-w-0">
              <p className="text-sm truncate">{profile?.full_name}</p>
              <p className="text-xs text-muted">{isAdmin ? "Administrador" : "Personal"}</p>
            </div>
            <button onClick={logout} className="text-muted hover:text-ink p-2" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-line bg-bg/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-accent text-accent-ink grid place-items-center text-sm font-bold">B</div>
          <span className="font-semibold">Barra</span>
          {demo && <span className="text-[11px] text-accent border border-accent/30 rounded px-1.5">demo</span>}
        </div>
        <button onClick={logout} className="text-muted hover:text-ink p-2" aria-label="Cerrar sesión">
          <LogOut size={18} />
        </button>
      </header>

      <main className="flex-1 min-w-0 px-4 md:px-8 py-5 md:py-7 pb-24 md:pb-8">{children}</main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-bg/95 backdrop-blur flex">
        {items.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cx("flex-1 flex flex-col items-center justify-center gap-0.5 h-16 text-[11px]", active ? "text-accent" : "text-muted")}
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
