import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: { default: "Fieldnote", template: "%s | Fieldnote" }, description: "Pesquisa de campo que vira decisão confiável." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
