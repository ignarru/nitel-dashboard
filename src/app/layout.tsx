import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Nitel — Revisión de correos",
  description: "Dashboard de revisión y envío de secuencias de correos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${outfit.variable} dark`}>
      <body className="font-sans antialiased text-zinc-100 min-h-screen bg-[#0a0a0f] relative">
        {/* Grid pattern sutil estilo Nitel */}
        <div
          aria-hidden
          className="fixed inset-0 pointer-events-none opacity-[0.35] z-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* Glow radial detrás de todo */}
        <div
          aria-hidden
          className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full pointer-events-none z-0"
          style={{
            background:
              "radial-gradient(closest-side, rgba(119,14,255,0.10), rgba(1,220,253,0.04) 60%, transparent 80%)",
          }}
        />
        <div className="relative z-10">{children}</div>
        <Toaster
          position="top-right"
          richColors
          closeButton
          theme="dark"
          toastOptions={{
            style: {
              background: "#14141f",
              border: "1px solid rgba(1,220,253,0.18)",
              color: "#f4f4f5",
            },
          }}
        />
      </body>
    </html>
  );
}
