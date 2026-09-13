'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client-api';
import { useWorkspace } from './workspace-context';

type Session = {
  id: string;
  scheduledAt: string;
  method: string;
  status: string;
};
type Participant = {
  id: string;
  displayName: string;
  consentStatus: string;
};
type Evidence = {
  id: string;
  text: string;
  kind: string;
  timestampSeconds: number | null;
  tags: string[];
};
type Theme = {
  id: string;
  title: string;
  summary: string;
  confidence: string;
  evidences: { evidenceId: string }[];
};

export function ProjectWorkspace({
  projectId,
  archived
}: {
  projectId: string;
  archived: boolean;
}) {
  const { role } = useWorkspace();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [tab, setTab] = useState('Sessões');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [participantError, setParticipantError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const canWrite = role !== 'VIEWER' && !archived;
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setParticipantsLoading(true);
    setParticipantError('');
    void api<Participant[]>(`/api/v1/projects/${projectId}/participants`)
      .then(setParticipants)
      .catch((cause) => {
        setParticipants([]);
        setParticipantError(errorMessage(cause));
      })
      .finally(() => setParticipantsLoading(false));
    try {
      const nextSessions = await api<Session[]>(
        `/api/v1/projects/${projectId}/sessions`
      );
      setSessions(nextSessions);
      const listed = (
        await Promise.all(
          nextSessions.map((session) =>
            api<Evidence[]>(`/api/v1/sessions/${session.id}/evidences`)
          )
        )
      ).flat();
      setEvidence(listed);
      setThemes(await api<Theme[]>(`/api/v1/projects/${projectId}/themes`));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  useEffect(() => {
    void load();
  }, [load]);
  async function saveSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const participantId = String(form.get('participantId') || '');
    try {
      await api(`/api/v1/projects/${projectId}/sessions`, {
        method: 'POST',
        body: JSON.stringify({
          ...(participantId ? { participantId } : {}),
          scheduledAt: new Date(String(form.get('scheduledAt'))).toISOString(),
          method: form.get('method'),
          status: form.get('status'),
          guide: form.get('guide') || null
        })
      });
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  async function saveEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sessionId = String(form.get('sessionId'));
    if (!sessionId) return setError('Selecione uma sessão.');
    setSaving(true);
    try {
      await api(`/api/v1/sessions/${sessionId}/evidences`, {
        method: 'POST',
        headers: { 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          text: form.get('text'),
          kind: form.get('kind'),
          timestampSeconds: form.get('timestampSeconds')
            ? Number(form.get('timestampSeconds'))
            : null,
          tags: String(form.get('tags') || '')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        })
      });
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  async function editEvidence(item: Evidence) {
    const text = window.prompt('Evidência', item.text);
    if (!text || text === item.text) return;
    setSaving(true);
    try {
      await api(`/api/v1/evidences/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ text })
      });
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  async function deleteEvidence(id: string) {
    if (!window.confirm('Excluir esta evidência?')) return;
    setSaving(true);
    try {
      await api(`/api/v1/evidences/${id}`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  async function saveTheme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try {
      await api(`/api/v1/projects/${projectId}/themes`, {
        method: 'POST',
        body: JSON.stringify({
          title: form.get('title'),
          summary: form.get('summary'),
          confidence: form.get('confidence'),
          evidenceIds: selected
        })
      });
      setSelected([]);
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="detail-grid">
      <section>
        <div className="tabs" role="tablist" aria-label="Conteúdo do projeto">
          {['Sessões', 'Evidências', 'Temas'].map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
            >
              {name}
            </button>
          ))}
        </div>
        {archived && (
          <p className="notice">Projeto arquivado: conteúdo somente leitura.</p>
        )}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p role="status">Carregando dados do projeto...</p>
        ) : (
          <>
            {tab === 'Sessões' && (
              <>
                <section className="card">
                  <h2>Sessões</h2>
                  {sessions.length ? (
                    <ul className="list">
                      {sessions.map((session) => (
                        <li key={session.id}>
                          <strong>
                            {new Date(session.scheduledAt).toLocaleString(
                              'pt-BR'
                            )}
                          </strong>
                          <br />
                          <span className="muted">
                            {session.method} · {session.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Nenhuma sessão.</p>
                  )}
                </section>
                {canWrite && (
                  <form className="card" onSubmit={saveSession}>
                    <h2>Criar sessão</h2>
                    <div className="field">
                      <label htmlFor="scheduledAt">Data</label>
                      <input
                        id="scheduledAt"
                        name="scheduledAt"
                        type="datetime-local"
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="method">Método</label>
                      <select id="method" name="method">
                        <option value="INTERVIEW">Entrevista</option>
                        <option value="OBSERVATION">Observação</option>
                        <option value="USABILITY_TEST">
                          Teste de usabilidade
                        </option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="participantId">Participante</label>
                      {participantsLoading ? (
                        <p role="status">Carregando participantes...</p>
                      ) : (
                        <>
                          {participantError && (
                            <p className="notice" role="alert">
                              {participantError}
                            </p>
                          )}
                          <select id="participantId" name="participantId">
                            <option value="">Sem participante</option>
                            {!participantError &&
                              participants.map((participant) => (
                                <option
                                  key={participant.id}
                                  value={participant.id}
                                >
                                  {participant.displayName} ·{' '}
                                  {participant.consentStatus}
                                </option>
                              ))}
                          </select>
                          {!participantError && participants.length === 0 && (
                            <p className="muted">
                              Nenhum participante disponível.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    <input name="status" type="hidden" value="PLANNED" />
                    <div className="field">
                      <label htmlFor="guide">Guia</label>
                      <textarea id="guide" name="guide" />
                    </div>
                    <button className="button" disabled={saving}>
                      Criar sessão
                    </button>
                  </form>
                )}
              </>
            )}
            {tab === 'Evidências' && (
              <>
                <section className="card">
                  <h2>Evidências</h2>
                  {evidence.length ? (
                    <ul className="list">
                      {evidence.map((item) => (
                        <li className="evidence" key={item.id}>
                          <label>
                            <input
                              type="checkbox"
                              checked={selected.includes(item.id)}
                              onChange={() =>
                                setSelected((ids) =>
                                  ids.includes(item.id)
                                    ? ids.filter((id) => id !== item.id)
                                    : [...ids, item.id]
                                )
                              }
                              disabled={!canWrite}
                            />{' '}
                            Selecionar
                          </label>
                          <strong>{item.kind}</strong>
                          <p>{item.text}</p>
                          <span className="muted">{item.tags.join(', ')}</span>
                          {canWrite && (
                            <span>
                              <button
                                className="button secondary"
                                type="button"
                                onClick={() => editEvidence(item)}
                                disabled={saving}
                              >
                                Editar
                              </button>{' '}
                              <button
                                className="button secondary"
                                type="button"
                                onClick={() => deleteEvidence(item.id)}
                                disabled={saving}
                              >
                                Excluir
                              </button>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Nenhuma evidência.</p>
                  )}
                </section>
                {canWrite && (
                  <form className="card" onSubmit={saveEvidence}>
                    <h2>Registrar evidência</h2>
                    <div className="field">
                      <label htmlFor="sessionId">Sessão</label>
                      <select id="sessionId" name="sessionId" required>
                        <option value="">Selecione</option>
                        {sessions.map((session) => (
                          <option key={session.id} value={session.id}>
                            {new Date(session.scheduledAt).toLocaleString(
                              'pt-BR'
                            )}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="text">Texto</label>
                      <textarea
                        id="text"
                        name="text"
                        required
                        maxLength={5000}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="evidence-kind">Tipo</label>
                      <select id="evidence-kind" name="kind">
                      <option value="QUOTE">Citação</option>
                      <option value="OBSERVATION">Observação</option>
                      <option value="NOTE">Nota</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="timestamp-seconds">Timestamp em segundos</label>
                      <input
                        id="timestamp-seconds"
                      name="timestampSeconds"
                      type="number"
                      min="0"
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="evidence-tags">Tags separadas por vírgula</label>
                      <input
                        id="evidence-tags"
                      name="tags"
                      placeholder="tags, separadas por vírgula"
                      />
                    </div>
                    <button className="button" disabled={saving}>
                      Salvar evidência
                    </button>
                  </form>
                )}
              </>
            )}
            {tab === 'Temas' && (
              <>
                <section className="card">
                  <h2>Temas</h2>
                  {themes.length ? (
                    <ul className="list">
                      {themes.map((theme) => (
                        <li key={theme.id}>
                          <strong>{theme.title}</strong>
                          <p>{theme.summary}</p>
                          <span className="muted">
                            {theme.confidence} · {theme.evidences.length} fontes
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Nenhum tema.</p>
                  )}
                </section>
                {canWrite && (
                  <form className="card" onSubmit={saveTheme}>
                    <h2>Criar tema</h2>
                    <p className="muted">
                      Selecione evidências na aba anterior.
                    </p>
                    <div className="field">
                      <label htmlFor="theme-title">Título</label>
                      <input id="theme-title" name="title" required />
                    </div>
                    <div className="field">
                      <label htmlFor="summary">Síntese</label>
                      <textarea id="summary" name="summary" required />
                    </div>
                    <select name="confidence">
                      <option value="LOW">Baixa</option>
                      <option value="MEDIUM">Média</option>
                      <option value="HIGH">Alta</option>
                    </select>
                    <button
                      className="button"
                      disabled={saving || !selected.length}
                    >
                      Criar tema com {selected.length} fonte(s)
                    </button>
                  </form>
                )}
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
