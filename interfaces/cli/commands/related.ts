import { loadAppConfig } from '../../../infra/config/app-config';
import { NodeVaultScanner } from '../../../infra/filesystem/readers/node-vault-scanner';
import { NodeNoteReader } from '../../../infra/filesystem/readers/node-note-reader';
import { VaultVerificationService } from '../../../vault/services/vault-verification.service';
import { createSemanticNoteRelationsService } from '../../../application/services/semantic-note-relations.service';

export interface RelatedCommandOptions {
  readonly vaultRoot?: string;
  readonly path?: string;
  readonly limit?: number;
}

export async function executeRelatedCommand(options: RelatedCommandOptions): Promise<void> {
  const config = loadAppConfig();
  const vaultRoot = options.vaultRoot?.trim() || config.vaultRoot;
  const service = new VaultVerificationService(new NodeVaultScanner());
  const noteReader = new NodeNoteReader();
  const relations = createSemanticNoteRelationsService();
  const report = await service.verify(vaultRoot);
  const notes = await noteReader.listNotes(report.vaultRoot);
  const pathValue = options.path?.trim();
  const limit = Number.isFinite(options.limit) ? options.limit : 12;

  if (!pathValue) {
    console.log('Missing note path. Use --path <note.md>.');
    return;
  }

  const result = relations.getRelated(report.vaultRoot, notes, pathValue, limit);

  console.log(`Vault: ${result.vaultRoot}`);
  console.log(`Source: ${result.sourcePath}`);
  console.log('');

  if (result.manualLinks.length > 0) {
    console.log('Manual links:');
    for (const link of result.manualLinks) {
      console.log(`- ${link.targetPath ?? link.label} (${link.kind})`);
    }
    console.log('');
  }

  if (result.backlinks.length > 0) {
    console.log('Backlinks:');
    for (const link of result.backlinks) {
      console.log(`- ${link.targetPath ?? link.label}`);
    }
    console.log('');
  }

  if (result.related.length === 0) {
    console.log('No inferred related notes above threshold.');
    return;
  }

  console.log('Related notes:');
  for (const item of result.related) {
    console.log(`- ${item.path} - ${item.title}`);
    console.log(`  score: ${item.score.toFixed(3)} (${item.intensity})`);
    console.log(`  signals: tfidf=${item.signals.tfidf.toFixed(3)} tags=${item.signals.tags.toFixed(3)} title=${item.signals.titleHeadings.toFixed(3)} links=${item.signals.links.toFixed(3)} folder=${item.signals.folder.toFixed(3)}`);
    console.log(`  reasons: ${item.reasons.join('; ')}`);
  }
}
