import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import { UIProvider } from "@/components/ui/UIProvider";

export const metadata: Metadata = {
  title: "Gerenciador de Horários - Gestão Inteligente de Horários Escolares",
  description:
    "Sistema avançado de geração automática e gestão de grades horárias acadêmicas.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="layout-fixed sidebar-expand-lg bg-body-tertiary">
        <UIProvider>{children}</UIProvider>
      </body>
    </html>
  );
}
