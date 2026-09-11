"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

const items = [ ["Dashboard", "/dashboard"], ["Projetos", "/projects"], ["Configurações", "/settings"] ];

export function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname();
  const slug = pathname.split("/")[2] || "fieldnote-demo";
  const [menu, setMenu] = useState(false);
  useEffect(() => { if (!menu) return; const close = (event: KeyboardEvent) => event.key === "Escape" && setMenu(false); window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [menu]);
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const value = new FormData(event.currentTarget).get("q"); if (value) window.location.assign(`/w/${slug}/projects?q=${encodeURIComponent(String(value))}`); }
  const links = <nav className="side-nav" aria-label="Navegação principal">{items.map(([name, suffix]) => { const href = `/w/${slug}${suffix}`; return <Link key={name} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setMenu(false)}>{name}</Link>; })}</nav>;
  return <div className="app-layout"><a className="skip-link" href="#main">Pular para conteúdo</a><aside className="sidebar"><Link href={`/w/${slug}/dashboard`} className="wordmark">Fieldnote</Link><button className="workspace" type="button">Fieldnote Demo · Researcher</button>{links}<div className="profile">Marina Oliveira<br /><span>Pesquisadora UX</span></div></aside>{menu && <div className="dialog-backdrop" role="presentation" onClick={() => setMenu(false)}><aside className="sidebar" role="dialog" aria-modal="true" aria-label="Menu" onClick={(e) => e.stopPropagation()}>{links}</aside></div>}<div className="app-main"><header className="topbar"><button className="button secondary menu-button" type="button" aria-expanded={menu} onClick={() => setMenu(true)}>Menu</button><span className="muted">{title}</span><form role="search" onSubmit={search}><label className="sr-only" htmlFor="app-search">Buscar</label><input id="app-search" name="q" placeholder="Buscar projetos e evidências" /></form></header><main id="main">{children}</main></div></div>;
}
