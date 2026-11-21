import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "@/components/ui/sonner";

// Sello UV type: a bold grotesk with optical sizes for the interface, a mono for figures, times and codes.
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], axes: ["opsz"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nox · Ventas de la noche",
  description: "Registro de ventas y comprobantes de pago",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#17122b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  // paint under the notch and home bar; content pads back out with env(safe-area-inset-*)
  viewportFit: "cover",
  // the software keyboard shrinks the layout so bottom-pinned buttons stay visible
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="dark">
      <body className={`${bricolage.variable} ${jetbrains.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
