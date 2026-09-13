"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useWorkspace } from "@/components/workspace-context";
import { api, errorMessage } from "@/lib/client-api";

type Project = { id: string; name: string; objective: string; status: string };
type Session = { id: string; scheduledAt: string; method: string; status: string };

export default function DashboardPage() {
  const { slug } = useWorkspace(); const [projects, setProjects] = useState<Project[]>([]); const [sessions, setSessions] = useState<Session[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { void (async () => { setLoading(true); try { const list = (await api<{ items: Project[] }>(`/api/v1/workspaces/${slug}/projects?limit=50`)).items; setProjects(list); setSessions((await Promise.all(list.filter((project) => project.status === "ACTIVE").map((project) => api<Session[]>(`/api/v1/projects/${project.id}/sessions`)))).flat()); } catch (cause) { setError(errorMessage(cause)); } finally { setLoading(false); } })(); }, [slug]);
  const upcoming = sessions.filter((session) => session.scheduledAt >= new Date().toISOString()).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)).slice(0, 5);
  return <AppShell title="Dashboard"><div className="page-wrap"><div className="page-heading"><div><p className="eyebrow">WORKSPACE</p><h1>Dashboard</h1><p>Dados atuais e autorizados.</p></div><Link className="button" href={`/w/${slug}/projects`}>Criar projeto</Link></div>{error && <p className="notice" role="alert">{error}</p>}{loading ? <p role="status">Carregando dashboard...</p> : <><section className="metric-grid" aria-label="Métricas do workspace"><div className="card"><span className="muted">Projetos ativos</span><strong className="metric-value">{projects.filter((project) => project.status === "ACTIVE").length}</strong></div><div className="card"><span className="muted">Sessões</span><strong className="metric-value">{sessions.length}</strong></div><div className="card"><span className="muted">Tarefas de síntese</span><strong className="metric-value">UNKNOWN</strong></div></section><section className="dashboard-grid"><article className="card"><h2>Próximas sessões</h2>{upcoming.length ? <ul className="list">{upcoming.map((session) => <li key={session.id}><strong>{new Date(session.scheduledAt).toLocaleString("pt-BR")}</strong><br /><span className="muted">{session.method} · {session.status}</span></li>)}</ul> : <p className="muted">Nenhuma sessão futura.</p>}</article><article className="card span-all"><h2>Projetos recentes</h2>{projects.length ? <div className="project-grid">{projects.slice(0, 6).map((project) => <Link className="card project-card" key={project.id} href={`/w/${slug}/projects/${project.id}`}><span className="pill">{project.status}</span><h2>{project.name}</h2><p className="muted">{project.objective}</p></Link>)}</div> : <p className="muted">Nenhum projeto neste workspace.</p>}</article></section></>}</div></AppShell>;
}
