"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Spinner } from "@/components/ui";

const ADMIN_ONLY = ["/cierre", "/actividad", "/reportes", "/productos", "/equipo"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, loading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const blocked = !isAdmin && ADMIN_ONLY.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!profile) router.replace("/login");
    else if (blocked) router.replace("/");
  }, [loading, profile, blocked, router]);

  if (loading || !profile || blocked) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Spinner />
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
}
