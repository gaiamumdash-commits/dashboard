import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

// Aplica o tema salvo antes do primeiro paint, pra não piscar o tema errado.
const SCRIPT_TEMA = `
try {
  var tema = localStorage.getItem("gaiamum-theme");
  if (tema === "light" || tema === "black") document.documentElement.dataset.theme = tema;
} catch (e) {}
`;

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.gaiamum.com.br"),
  title: "Gaiamum Dashboard",
  description: "Command Center do empreendedor: metas, projetos e tarefas em um lugar só.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#011f51",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        {children}
        <ThemeToggle />
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
