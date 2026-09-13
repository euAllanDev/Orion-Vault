"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { AccessibleDialog } from "./accessible-dialog";
import { useWorkspace } from "./workspace-context";

const items = [ ["Dashboard", "/dashboard"], ["Projetos", "/projects"], ["Configurações", "/settings"] ];

export function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname();
  const { slug, name, role, userName } = useWorkspace();
  const [menu, setMenu] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const value = new FormData(event.currentTarget).get("q"); if (value) window.location.assign(`/w/${slug}/projects?q=${encodeURIComponent(String(value))}`); }
  const links = <nav className="side-nav" aria-label="Navegação principal">{items.map(([name, suffix]) => { const href = `/w/${slug}${suffix}`; return <Link key={name} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setMenu(false)}>{name}</Link>; })}</nav>;
  return <div className="app-layout"><a className="skip-link" href="#main">Pular para conteúdo</a><aside className="sidebar"><Link href={`/w/${slug}/dashboard`} className="wordmark">Fieldnote</Link><button className="workspace" type="button">{name} · {role}</button>{links}<div className="profile">{userName}<br /><span>{role}</span></div></aside><div className="app-main"><header className="topbar"><button ref={menuTriggerRef} className="button secondary menu-button" type="button" aria-expanded={menu} aria-haspopup="dialog" onClick={() => setMenu(true)}>Menu</button><span className="muted">{title}</span><form role="search" onSubmit={search}><label className="sr-only" htmlFor="app-search">Buscar</label><input id="app-search" name="q" placeholder="Buscar projetos" /></form></header><main id="main">{children}</main></div>{menu && <AccessibleDialog label="Menu" onClose={() => setMenu(false)} returnFocusRef={menuTriggerRef}>{links}</AccessibleDialog>}</div>;
}
