"use client";

import { useCallback, useEffect, useState } from "react";
import { getApi } from "@/lib/data";
import { resetDemo } from "@/lib/data/demo";
import { useAuth } from "@/lib/auth";
import type { Profile, Role } from "@/lib/types";
import { Button, Card, PageHeader, Select, Spinner, cx } from "@/components/primitives";

export default function TeamPage() {
  const { profile: me } = useAuth();
  const [people, setPeople] = useState<Profile[] | null>(null);
  const demo = getApi().mode === "demo";

  const load = useCallback(async () => setPeople(await getApi().listProfiles()), []);
  useEffect(() => {
    load().catch(() => setPeople([]));
  }, [load]);

  const update = async (id: string, patch: Partial<Profile>) => {
    await getApi().updateProfile(id, patch);
    load();
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="Equipo" subtitle="Roles y acceso del personal." />

      <Card className="divide-y divide-line mb-6">
        {!people ? (
          <div className="py-10 grid place-items-center">
            <Spinner />
          </div>
        ) : (
          people.map((p) => {
            const self = p.id === me?.id;
            return (
              <div key={p.id} className={cx("flex flex-wrap items-center gap-3 px-4 py-3", !p.active && "opacity-50")}>
                <div className="flex-1 min-w-40">
                  <p className="text-sm">
                    {p.full_name || "Sin nombre"} {self && <span className="text-xs text-muted-foreground">(tú)</span>}
                  </p>
                  {p.email && <p className="text-xs text-muted-foreground">{p.email}</p>}
                </div>
                <Select value={p.role} disabled={self} onChange={(e) => update(p.id, { role: e.target.value as Role })} className="h-8">
                  <option value="staff">Personal</option>
                  <option value="admin">Administrador</option>
                </Select>
                <Button size="sm" variant={p.active ? "ghost" : "ok"} disabled={self} onClick={() => update(p.id, { active: !p.active })}>
                  {p.active ? "Desactivar" : "Activar"}
                </Button>
              </div>
            );
          })
        )}
      </Card>

      <Card className="p-5 text-sm text-ink-2 space-y-2">
        <h2 className="font-semibold text-ink">Agregar personal</h2>
        {demo ? (
          <p>En modo demo hay dos usuarios fijos. Con Supabase configurado, los usuarios se crean desde el panel de Supabase.</p>
        ) : (
          <ol className="list-decimal pl-5 space-y-1">
            <li>En Supabase, ve a Authentication → Users → Add user.</li>
            <li>Ingresa email y contraseña y marca “Auto confirm user”.</li>
            <li>El usuario aparece aquí como Personal. Cambia su rol si debe ser administrador.</li>
          </ol>
        )}
      </Card>

      {demo && (
        <Card className="p-5 mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-2">Borrar todas las ventas y productos del modo demo.</p>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (confirm("¿Borrar todos los datos demo de este navegador?")) {
                resetDemo();
                location.reload();
              }
            }}
          >
            Reiniciar demo
          </Button>
        </Card>
      )}
    </div>
  );
}
