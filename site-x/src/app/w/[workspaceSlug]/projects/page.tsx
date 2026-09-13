"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AccessibleDialog } from "@/components/accessible-dialog";
import { AppShell } from "@/components/app-shell";
import { useWorkspace } from "@/components/workspace-context";
import { api, errorMessage } from "@/lib/client-api";

type Project = { id: string; name: string; objective: string; status: "ACTIVE" | "ARCHIVED"; _count?: { sessions: number } };

export default function ProjectsPage() {
  const { slug, role } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const canWrite = role !== "VIEWER";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setProjects((await api<{ items: Project[] }>(`/api/v1/workspaces/${slug}/projects?limit=50${status ? `&status=${status}` : ""}`)).items); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, [slug, status]);
  useEffect(() => { void load(); }, [load]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    try { await api(`/api/v1/workspaces/${slug}/projects`, { method: "POST", body: JSON.stringify({ name: form.get("name"), objective: form.get("objective") }) }); setOpen(false); await load(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  }
  const visible = projects.filter((project) => `${project.name} ${project.objective}`.toLowerCase().includes(query.toLowerCase()));
  return <AppShell title="Projetos"><div className="page-wrap"><div className="page-heading"><div><p className="eyebrow">ESTUDOS</p><h1>Projetos</h1><p>Dados persistidos neste workspace.</p></div>{canWrite && <button ref={createTriggerRef} className="button" onClick={() => setOpen(true)}>Criar projeto</button>}</div><div className="toolbar"><label className="sr-only" htmlFor="project-search">Buscar projetos carregados</label><input id="project-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar projetos carregados" /><label className="sr-only" htmlFor="project-status">Filtrar por status</label><select id="project-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Ativos e arquivados</option><option value="ACTIVE">Ativos</option><option value="ARCHIVED">Arquivados</option></select></div>{error && <p className="notice" role="alert">{error}</p>}{loading ? <p role="status">Carregando projetos...</p> : visible.length ? <div className="project-grid">{visible.map((project) => <Link className="card project-card" key={project.id} href={`/w/${slug}/projects/${project.id}`}><span className="pill">{project.status === "ACTIVE" ? "Ativo" : "Arquivado"}</span><h2>{project.name}</h2><p className="muted">{project.objective}</p><span className="muted">{project._count?.sessions ?? 0} sessões</span></Link>)}</div> : <section className="card"><h2>Nenhum projeto encontrado</h2><p className="muted">Crie um projeto ou ajuste o filtro.</p></section>}{open && <AccessibleDialog label="Criar projeto" onClose={() => !saving && setOpen(false)} returnFocusRef={createTriggerRef}><form onSubmit={create}><h2>Criar projeto</h2><div className="field"><label htmlFor="name">Nome</label><input id="name" name="name" required maxLength={100} /></div><div className="field"><label htmlFor="objective">Objetivo</label><textarea id="objective" name="objective" required /></div><button className="button" disabled={saving}>{saving ? "Criando..." : "Criar projeto"}</button><button className="button secondary" type="button" disabled={saving} onClick={() => setOpen(false)}>Cancelar</button></form></AccessibleDialog>}</div></AppShell>;
}
