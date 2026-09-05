import type { AiBridgeAgentContextRequestDto, AiBridgeSearchRequestDto } from '../dto/ai-bridge.dto';
import type { RelationIntensity } from '../dto/semantic-note-relations.dto';
import type { NoteSourcePort } from '../ports/note-source.port';
import { contextAcrossVaults, readAcrossVaults, readFromVault, searchAcrossVaults, type MultiVaultReadResult, type OrionMultiVaultService } from '../../interfaces/mcp/orion-multi-vault';
import type { OrionSourceRegistry } from './orion-source-registry';
import { createSemanticNoteRelationsService, type SemanticNoteRelationsService } from './semantic-note-relations.service';

export const ORION_RELATED_LIMIT = 12;

export interface OrionRelatedNote {
  readonly path: string;
  readonly sourceRef: string;
  readonly title: string;
  readonly score: number;
  readonly kind: 'manual' | 'backlink' | 'inferred';
  readonly intensity: RelationIntensity;
}

export type OrionRelatedResult =
  | { readonly status: 'success'; readonly results: readonly OrionRelatedNote[] }
  | { readonly status: 'not-found' | 'vault-unavailable'; readonly results: readonly [] };

export interface OrionKnowledgeFacadeDependencies {
  readonly service: OrionMultiVaultService;
  readonly noteSource: NoteSourcePort;
  readonly vaultRoots: readonly string[];
  readonly sourceRegistry: OrionSourceRegistry;
  readonly relations?: SemanticNoteRelationsService;
}

/** Protocol-independent entry point for navigating configured Orion Vaults. */
export class OrionKnowledgeFacade {
  constructor(private readonly dependencies: OrionKnowledgeFacadeDependencies) {}

  search(input: Omit<AiBridgeSearchRequestDto, 'vaultRoot'>) {
    return searchAcrossVaults(this.dependencies.service, this.dependencies.vaultRoots, input, this.dependencies.sourceRegistry);
  }

  context(input: Omit<AiBridgeAgentContextRequestDto, 'vaultRoot'>) {
    return contextAcrossVaults(this.dependencies.service, this.dependencies.vaultRoots, input, this.dependencies.sourceRegistry);
  }

  async read(input: { readonly path?: string; readonly sourceRef?: string }): Promise<MultiVaultReadResult> {
    if (input.sourceRef) {
      const location = this.dependencies.sourceRegistry.resolve(input.sourceRef);
      if (!location) return { note: null, vaultAvailable: true };
      const vaultRoot = this.dependencies.vaultRoots[location.vaultIndex];
      return vaultRoot ? readFromVault(this.dependencies.noteSource, vaultRoot, location.relativePath) : { note: null, vaultAvailable: true };
    }
    return readAcrossVaults(this.dependencies.noteSource, this.dependencies.vaultRoots, input.path ?? '');
  }

  async related(sourceRef: string): Promise<OrionRelatedResult> {
    const location = this.dependencies.sourceRegistry.resolve(sourceRef);
    const vaultRoot = location && this.dependencies.vaultRoots[location.vaultIndex];
    if (!location || !vaultRoot) return { status: 'not-found', results: [] };

    let notes;
    try {
      notes = await this.dependencies.noteSource.listNotes(vaultRoot);
    } catch {
      return { status: 'vault-unavailable', results: [] };
    }

    if (!notes.some((note) => note.relativePath === location.relativePath)) {
      return { status: 'not-found', results: [] };
    }

    const relationData = (this.dependencies.relations ?? createSemanticNoteRelationsService())
      .getRelated(vaultRoot, notes, location.relativePath, ORION_RELATED_LIMIT);
    const notesByPath = new Map(notes.map((note) => [note.relativePath, note] as const));
    const results = new Map<string, OrionRelatedNote>();
    const add = (path: string | undefined, kind: OrionRelatedNote['kind'], score: number, intensity: RelationIntensity, title?: string) => {
      if (!path || path === location.relativePath || results.has(path)) return;
      const note = notesByPath.get(path);
      if (!note) return;
      results.set(path, {
        path,
        sourceRef: this.dependencies.sourceRegistry.register(location.vaultIndex, path),
        title: title ?? note.title ?? path,
        score,
        kind,
        intensity
      });
    };

    for (const link of [...relationData.manualLinks].sort((left, right) => (left.targetPath ?? '').localeCompare(right.targetPath ?? ''))) add(link.targetPath, 'manual', 1, 'strong', link.label);
    for (const link of [...relationData.backlinks].sort((left, right) => (left.targetPath ?? '').localeCompare(right.targetPath ?? ''))) add(link.targetPath, 'backlink', 1, 'strong', link.label);
    for (const related of relationData.related) add(related.path, 'inferred', related.score, related.intensity, related.title);

    return { status: 'success', results: [...results.values()].slice(0, ORION_RELATED_LIMIT) };
  }
}
