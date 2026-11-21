"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApi } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { Button, Input, Label } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { profile, loading, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const demo = getApi().mode === "demo";

  useEffect(() => {
    if (!loading && profile) router.replace("/");
  }, [loading, profile, router]);

  const signIn = async (e?: React.FormEvent, demoEmail?: string) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      await getApi().signIn(demoEmail ?? email, password);
      await refresh();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-accent text-accent-ink grid place-items-center text-lg font-bold">B</div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Barra</h1>
            <p className="text-sm text-ink-2">Registro de ventas y pagos</p>
          </div>
        </div>

        {demo ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-2 mb-4">
              Modo demo: no hay Supabase configurado. Los datos se guardan solo en este navegador.
            </p>
            <Button variant="primary" size="lg" className="w-full" disabled={busy} onClick={() => signIn(undefined, "admin@demo")}>
              Entrar como administrador
            </Button>
            <Button size="lg" className="w-full" disabled={busy} onClick={() => signIn(undefined, "barra@demo")}>
              Entrar como personal de barra
            </Button>
          </div>
        ) : (
          <form onSubmit={signIn} className="space-y-4">
            <label className="block">
              <Label>Email</Label>
              <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block">
              <Label>Contraseña</Label>
              <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
              {busy ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
        )}
        {error && <p className="mt-4 text-sm text-bad">{error}</p>}
      </div>
    </div>
  );
}
