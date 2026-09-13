"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectWorkspace } from "@/components/project-workspace";
import { useWorkspace } from "@/components/workspace-context";
import { api, errorMessage } from "@/lib/client-api";

type Project = { id: string; name: string; objective: string; status: "ACTIVE" | "ARCHIVED" };
export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>(); const { slug, role } = useWorkspace(); const router = useRouter(); const [project, setProject] = useState<Project | null>(null); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { try { setProject(await api<Project>(`/api/v1/projects/${projectId}`)); } catch (cause) { setError(errorMessage(cause)); } }, [projectId]);
  useEffect(() => { void load(); }, [load]);
  async function update(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); const form = new FormData(event.currentTarget); try { await api(`/api/v1/projects/${projectId}`, { method: "PATCH", body: JSON.stringify({ name: form.get("name"), objective: form.get("objective") }) }); await load(); } catch (cause) { setError(errorMessage(cause)); } finally { setSaving(false); } }
  async function archive() { setSaving(true); try { await api(`/api/v1/projects/${projectId}/archive`, { method: "POST" }); await load(); } catch (cause) { setError(errorMessage(cause)); } finally { setSaving(false); } }
  if (error) return <AppShell title="Projeto"><div className="page-wrap"><p className="notice" role="alert">{error}</p><button className="button secondary" onClick={() => router.push(`/w/${slug}/projects`)}>Voltar</button></div></AppShell>;
  if (!project) return <AppShell title="Projeto"><div className="page-wrap"><p role="status">Carregando projeto...</p></div></AppShell>;
  const archived = project.status === "ARCHIVED"; const canEdit = role !== "VIEWER" && !archived; const canArchive = role === "OWNER" || role === "ADMIN";
  return <AppShell title={`Projetos / ${project.name}`}><div className="page-wrap"><div className="page-heading"><div><p className="eyebrow">{archived ? "PROJETO ARQUIVADO" : "PROJETO ATIVO"}</p><h1>{project.name}</h1><p>{project.objective}</p></div><span className="pill">{project.status}</span></div>{canEdit && <form className="card" onSubmit={update}><h2>Editar projeto</h2><div className="field"><label htmlFor="project-name">Nome</label><input id="project-name" name="name" defaultValue={project.name} required maxLength={100} /></div><div className="field"><label htmlFor="project-objective">Objetivo</label><textarea id="project-objective" name="objective" defaultValue={project.objective} required /></div><button className="button" disabled={saving}>Salvar alterações</button>{canArchive && <button className="button secondary" type="button" disabled={saving} onClick={archive}>Arquivar</button>}</form>}<ProjectWorkspace projectId={project.id} archived={archived} /></div></AppShell>;
}
