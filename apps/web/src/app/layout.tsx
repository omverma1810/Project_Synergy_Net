import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "sonner";
import dynamic from "next/dynamic";

const SynergyAdvisor = dynamic(() => import("@/components/SynergyAdvisor"), { ssr: false });

export const metadata: Metadata = {
  title: "Synergy Net — Production Finance Intelligence",
  description:
    "Map any production budget to global film incentives in seconds. Rank the top territories by net economic yield across Europe, EMEA & Asia.",
  keywords: ["film finance", "tax incentives", "production rebates", "co-production", "film tax credit"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="app-aurora bg-synergy-dark text-synergy-text antialiased font-sans">
        <div className="relative z-10">{children}</div>
        <SynergyAdvisor />
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'rgba(20, 30, 51, 0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid #27324a',
              color: '#f1f5f9',
            },
          }}
        />
      </body>
    </html>
  );
}
