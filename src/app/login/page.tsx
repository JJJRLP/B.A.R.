"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eye, EyeOff } from "lucide-react";
import { getApi } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { Button, Input, Label, Wordmark, cx } from "@/components/primitives";

/**
 * Sign-in: the door of the venue. The only screen in Nox that glows; the light drifts
 * around the screen edges through the plan inks while the form itself stays flat and sharp.
 */
export default function LoginPage() {
  const router = useRouter();
  const { profile, loading, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="relative min-h-dvh flex flex-col px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div aria-hidden className="edge-glow" />

      <main className="relative flex-1 grid place-items-center">
        <div className="w-full max-w-sm">
          <h1 className="mb-3">
            <Wordmark className="text-[clamp(4.5rem,22vw,6.5rem)] tracking-[-0.05em]" />
          </h1>
          <p className="text-lg leading-snug text-ink-2 mb-10 max-w-[28ch]">
            Ventas de la noche: puerta y barra en un solo registro.
          </p>

          {demo ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-2 mb-4">Modo demo: no hay Supabase configurado. Los datos se guardan solo en este navegador.</p>
              <Button variant="primary" size="lg" className="w-full h-14 text-lg font-bold rounded-2xl" disabled={busy} onClick={() => signIn(undefined, "admin@demo")}>
                Entrar como administrador
              </Button>
              <Button size="lg" className="w-full h-14 rounded-2xl" disabled={busy} onClick={() => signIn(undefined, "barra@demo")}>
                Entrar como personal de barra
              </Button>
            </div>
          ) : (
            <form onSubmit={signIn} className="space-y-4">
              <label className="block">
                <Label>Email</Label>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error || undefined}
                  className="h-12 rounded-xl bg-card"
                />
              </label>
              <label className="block">
                <Label>Contraseña</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    enterKeyHint="go"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={!!error || undefined}
                    className="h-12 rounded-xl bg-card pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 size-10 grid place-items-center rounded-lg text-muted-foreground hover:text-ink"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              {error && (
                <p role="alert" className="flex gap-2 text-sm text-bad">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" size="lg" className={cx("w-full h-14 text-lg font-bold rounded-2xl !mt-6")} disabled={busy}>
                {busy ? "Ingresando…" : "Ingresar"}
              </Button>
            </form>
          )}
          {demo && error && <p role="alert" className="mt-4 text-sm text-bad">{error}</p>}
        </div>
      </main>
    </div>
  );
}
