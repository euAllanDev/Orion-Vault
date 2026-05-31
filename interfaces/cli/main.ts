import { executeContextCommand } from './commands/context';
import { executeApplyCommand } from './commands/apply';
import { executeDiffCommand } from './commands/diff';
import { executeDoctorCommand } from './commands/doctor';
import { executePlanCommand } from './commands/plan';
import { executeScanCommand } from './commands/scan';
import { executeSearchCommand } from './commands/search';
import { executeRetrieveCommand } from './commands/retrieve';
import { executeAgentContextCommand } from './commands/agent-context';
import { executeValidateCommand } from './commands/validate';
import { executeInspectCommand } from './commands/inspect';
import { executeOrganizeCommand } from './commands/organize';
import { executeSyncCommand } from './commands/sync';
import { executeCreateFolderCommand } from './commands/create-folder';
import { executeCreateFileCommand } from './commands/create-file';
import { executeEditCommand } from './commands/edit';
import { executeRenameCommand } from './commands/rename';
import { executeMoveCommand } from './commands/move';
import { executeRelatedCommand } from './commands/related';
import { executeSkillsCommand } from './commands/skills';
import { executeFlowsCommand } from './commands/flows';
import { executeOnboardingCommand } from './commands/onboarding';
import { executeAnalyzeNoteCommand } from './commands/analyze-note';
import { executeMaintenanceDiagnoseCommand } from './commands/maintenance-diagnose';
import { executePrepareWritingTaskCommand } from './commands/prepare-writing-task';
import { executeOrganizeBatchCommand } from './commands/organize-batch';
import { executePrepareEditTaskCommand } from './commands/prepare-edit-task';
import { executeProductContextCommand } from './commands/product-context';
import { executeRouteIntentCommand } from './commands/route-intent';
import { buildOrionGuideMarkdown, buildOrionStartMarkdown } from '../../application/ai/skills/skill-catalog';
import { ZodError } from 'zod';
import fs from 'node:fs/promises';
import { stdin } from 'node:process';
import { fileURLToPath } from 'node:url';

function parseArgs(argv: string[]) {
  const command = argv[0] ?? 'help';
  const valueOptions = new Set(['--vault', '--query', '--phrase', '--path', '--source', '--destination', '--content', '--content-file', '--tag', '--limit', '--preview-id', '--category']);
  const readOption = (name: string): string | undefined => {
    const index = argv.findIndex((arg) => arg === name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const readContentOption = (): string | undefined => {
    const index = argv.findIndex((arg) => arg === '--content');
    if (index < 0 || index + 1 >= argv.length) {
      return undefined;
    }

    const values: string[] = [];
    for (let cursor = index + 1; cursor < argv.length; cursor += 1) {
      const current = argv[cursor];
      if (current.startsWith('--') && valueOptions.has(current)) {
        break;
      }
      values.push(current);
    }

    return values.length > 0 ? values.join('\n') : '';
  };

  const dryRun = argv.includes('--dry-run');
  const debug = argv.includes('--debug');
  const json = argv.includes('--json');
  const vaultRoot = readOption('--vault') ?? process.env.ORION_VAULT_ROOT ?? process.env.MARIKA_VAULT_ROOT;
  const query = readOption('--query');
  const phrase = readOption('--phrase');
  const pathValue = readOption('--path');
  const source = readOption('--source');
  const destination = readOption('--destination');
  const content = readContentOption();
  const limit = readOption('--limit');
  const previewId = readOption('--preview-id');
  const category = readOption('--category');
  const contentFile = readOption('--content-file');
  const readStdin = argv.includes('--stdin');
  const force = argv.includes('--force');
  const plainArgs: string[] = [];

  for (let index = 1; index < argv.length; index += 1) {
    const current = argv[index];
    if (current.startsWith('--')) {
      if (valueOptions.has(current)) {
        index += 1;
      }
      continue;
    }

    plainArgs.push(current);
  }

  const tagValues = [] as string[];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--tag' && argv[index + 1]) {
      tagValues.push(...argv[index + 1].split(',').map((value) => value.trim()).filter(Boolean));
    }
  }

  return { command, vaultRoot, dryRun, debug, json, query, phrase, path: pathValue, source, destination, content, contentFile, readStdin, limit, previewId, force, tags: tagValues, plainArgs, category };
}

async function readStdinContent(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
}

async function resolveCommandContent(args: ReturnType<typeof parseArgs>): Promise<string | undefined> {
  const providers = [
    args.content !== undefined ? 'content' : null,
    args.contentFile ? 'content-file' : null,
    args.readStdin ? 'stdin' : null
  ].filter((value): value is string => Boolean(value));

  if (providers.length > 1) {
    throw new Error('Use only one content source: --content, --content-file, or --stdin.');
  }

  if (args.contentFile) {
    return fs.readFile(args.contentFile, 'utf8');
  }

  if (args.readStdin) {
    return readStdinContent();
  }

  return args.content;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const slashCommand = args.command.startsWith('/') ? args.command.slice(1) : args.command;
  const positionalInput = (args.plainArgs[0] ?? '').trim();
  const format = args.json || args.command.startsWith('/') ? 'json' as const : 'text' as const;

  try {
    if (slashCommand === 'organize' || slashCommand === 'preview') {
      await executeOrganizeCommand({ vaultRoot: args.vaultRoot, path: args.path, query: args.query, dryRun: true, format });
      return;
    }

    if (slashCommand === 'guide') {
      console.log(buildOrionGuideMarkdown());
      return;
    }

    if (slashCommand === 'start') {
      console.log(buildOrionStartMarkdown());
      return;
    }

    if (slashCommand === 'product-context') {
      await executeProductContextCommand({ format });
      return;
    }

    if (slashCommand === 'route-intent') {
      await executeRouteIntentCommand({ query: args.query ?? positionalInput, format });
      return;
    }

    if (slashCommand === 'agent-template') {
      const templatePath = fileURLToPath(new URL('../../ai-agent-template.md', import.meta.url));
      const content = await fs.readFile(templatePath, 'utf8');
      console.log(content);
      return;
    }

    if (slashCommand === 'skills') {
      await executeSkillsCommand({ category: args.category, format });
      return;
    }

    if (slashCommand === 'flows') {
      await executeFlowsCommand({ format });
      return;
    }

    if (slashCommand === 'analyze-note') {
      await executeAnalyzeNoteCommand({ vaultRoot: args.vaultRoot, path: args.path ?? (positionalInput || undefined), query: args.query, format });
      return;
    }

    if (slashCommand === 'maintenance-diagnose') {
      await executeMaintenanceDiagnoseCommand({ vaultRoot: args.vaultRoot, format });
      return;
    }

    if (slashCommand === 'prepare-writing-task') {
      await executePrepareWritingTaskCommand({ vaultRoot: args.vaultRoot, path: args.path ?? (positionalInput || undefined), query: args.query, tags: args.tags, format });
      return;
    }

    if (slashCommand === 'prepare-edit-task') {
      await executePrepareEditTaskCommand({ vaultRoot: args.vaultRoot, path: args.path ?? (positionalInput || undefined), query: args.query, tags: args.tags, format });
      return;
    }

    if (slashCommand === 'organize-batch') {
      await executeOrganizeBatchCommand({ vaultRoot: args.vaultRoot, path: args.path, query: args.query, format });
      return;
    }

    if (slashCommand === 'onboarding') {
      await executeOnboardingCommand({ format });
      return;
    }

    if (slashCommand === 'apply') {
      await executeApplyCommand({ vaultRoot: args.vaultRoot, previewId: args.previewId, path: args.path, query: args.query, force: args.force, format });
      return;
    }

    if (args.command === 'organize') {
      await executeOrganizeCommand({ vaultRoot: args.vaultRoot, path: args.path, query: args.query, dryRun: args.dryRun, format });
      return;
    }

    if (args.command === 'mkdir') {
      await executeCreateFolderCommand({ vaultRoot: args.vaultRoot, path: args.path });
      return;
    }

    if (args.command === 'touch') {
      await executeCreateFileCommand({ vaultRoot: args.vaultRoot, path: args.path, content: await resolveCommandContent(args) });
      return;
    }

    if (args.command === 'edit') {
      await executeEditCommand({ vaultRoot: args.vaultRoot, path: args.path, content: await resolveCommandContent(args) });
      return;
    }

    if (args.command === 'rename') {
      await executeRenameCommand({ vaultRoot: args.vaultRoot, source: args.source, destination: args.destination });
      return;
    }

    if (args.command === 'move') {
      await executeMoveCommand({ vaultRoot: args.vaultRoot, source: args.source, destination: args.destination });
      return;
    }

    if (slashCommand === 'inspect') {
      await executeInspectCommand({ vaultRoot: args.vaultRoot });
      return;
    }

    if (args.command === 'inspect') {
      await executeInspectCommand({ vaultRoot: args.vaultRoot });
      return;
    }

    if (args.command === 'validate') {
      await executeValidateCommand({ vaultRoot: args.vaultRoot });
      return;
    }

    if (args.command === 'scan') {
      await executeScanCommand({ vaultRoot: args.vaultRoot });
      return;
    }

    if (slashCommand === 'context') {
      await executeContextCommand({ vaultRoot: args.vaultRoot, path: args.path ?? (positionalInput || undefined), format });
      return;
    }

    if (args.command === 'context') {
      await executeContextCommand({ vaultRoot: args.vaultRoot, path: args.path, format });
      return;
    }

    if (args.command === 'doctor') {
      await executeDoctorCommand({ vaultRoot: args.vaultRoot });
      return;
    }

    if (slashCommand === 'search') {
      await executeSearchCommand({ vaultRoot: args.vaultRoot, query: args.query ?? (positionalInput || undefined), phrase: args.phrase, tags: args.tags, path: args.path, format });
      return;
    }

    if (slashCommand === 'retrieve') {
      await executeRetrieveCommand({ vaultRoot: args.vaultRoot, query: args.query ?? (positionalInput || undefined), tags: args.tags, path: args.path, format, debug: args.debug });
      return;
    }

    if (slashCommand === 'agent-context') {
      await executeAgentContextCommand({ vaultRoot: args.vaultRoot, query: args.query ?? (positionalInput || undefined), tags: args.tags, path: args.path ?? (positionalInput || undefined), format, debug: args.debug });
      return;
    }

    if (slashCommand === 'related') {
      await executeRelatedCommand({ vaultRoot: args.vaultRoot, path: args.path ?? (positionalInput || undefined), limit: args.limit ? Number.parseInt(args.limit, 10) : undefined });
      return;
    }

    if (args.command === 'search') {
      await executeSearchCommand({ vaultRoot: args.vaultRoot, query: args.query, phrase: args.phrase, tags: args.tags, path: args.path, format });
      return;
    }

    if (args.command === 'retrieve') {
      await executeRetrieveCommand({ vaultRoot: args.vaultRoot, query: args.query, tags: args.tags, path: args.path, format, debug: args.debug });
      return;
    }

    if (args.command === 'agent-context') {
      await executeAgentContextCommand({ vaultRoot: args.vaultRoot, query: args.query, tags: args.tags, path: args.path, format, debug: args.debug });
      return;
    }

    if (args.command === 'related') {
      await executeRelatedCommand({ vaultRoot: args.vaultRoot, path: args.path ?? (positionalInput || undefined), limit: args.limit ? Number.parseInt(args.limit, 10) : undefined });
      return;
    }

    if (args.command === 'skills') {
      await executeSkillsCommand({ category: args.category, format });
      return;
    }

    if (args.command === 'flows') {
      await executeFlowsCommand({ format });
      return;
    }

    if (args.command === 'analyze-note') {
      await executeAnalyzeNoteCommand({ vaultRoot: args.vaultRoot, path: args.path ?? (positionalInput || undefined), query: args.query, format });
      return;
    }

    if (args.command === 'maintenance-diagnose') {
      await executeMaintenanceDiagnoseCommand({ vaultRoot: args.vaultRoot, format });
      return;
    }

    if (args.command === 'prepare-writing-task') {
      await executePrepareWritingTaskCommand({ vaultRoot: args.vaultRoot, path: args.path ?? (positionalInput || undefined), query: args.query, tags: args.tags, format });
      return;
    }

    if (args.command === 'prepare-edit-task') {
      await executePrepareEditTaskCommand({ vaultRoot: args.vaultRoot, path: args.path ?? (positionalInput || undefined), query: args.query, tags: args.tags, format });
      return;
    }

    if (args.command === 'organize-batch') {
      await executeOrganizeBatchCommand({ vaultRoot: args.vaultRoot, path: args.path, query: args.query, format });
      return;
    }

    if (args.command === 'onboarding') {
      await executeOnboardingCommand({ format });
      return;
    }

    if (args.command === 'product-context') {
      await executeProductContextCommand({ format });
      return;
    }

    if (args.command === 'route-intent') {
      await executeRouteIntentCommand({ query: args.query ?? positionalInput, format });
      return;
    }

    if (slashCommand === 'plan') {
      await executePlanCommand({ vaultRoot: args.vaultRoot, path: args.path, query: args.query, format });
      return;
    }

    if (args.command === 'plan') {
      await executePlanCommand({ vaultRoot: args.vaultRoot, path: args.path, query: args.query, format });
      return;
    }

    if (args.command === 'diff') {
      await executeDiffCommand({ vaultRoot: args.vaultRoot });
      return;
    }

    if (args.command === 'sync') {
      await executeSyncCommand();
      return;
    }

    console.log('Usage: organize [--vault <path>] [--dry-run]');
    console.log('       /start');
    console.log('       /route-intent --query <text>');
    console.log('       /product-context');
    console.log('       /agent-template');
    console.log('       /guide');
    console.log('       /skills [--category <context|planning|execution|maintenance>]');
    console.log('       /flows');
    console.log('       /analyze-note [--vault <path>] [--path <note>] [--query <text>]');
    console.log('       /prepare-edit-task [--vault <path>] [--path <note>] [--query <text>] [--tag <tag>]');
    console.log('       /organize-batch [--vault <path>] [--path <scope>] [--query <text>]');
    console.log('       /maintenance-diagnose [--vault <path>]');
    console.log('       /prepare-writing-task [--vault <path>] [--path <note>] [--query <text>] [--tag <tag>]');
    console.log('       /onboarding');
    console.log('       /product-context');
    console.log('       /context [--vault <path>] [--path <note>]');
    console.log('       /search [--vault <path>] [--query <text>] [--phrase <text>] [--tag <tag>] [--path <scope>]');
    console.log('       /related [--vault <path>] [--path <note.md>] [--limit <n>]');
    console.log('       /retrieve [--vault <path>] [--query <text>] [--tag <tag>] [--path <scope>] [--debug]');
    console.log('       /agent-context [--vault <path>] [--query <text>] [--tag <tag>] [--path <scope-or-note>] [--debug]');
    console.log('       /plan [--vault <path>] [--path <scope>] [--query <text>]');
    console.log('       /preview [--vault <path>] [--path <scope>] [--query <text>]');
    console.log('       /apply [--vault <path>] [--path <scope>] [--query <text>] --preview-id <id> [--force]');
    console.log('       mkdir --vault <path> --path <folder>');
    console.log('       touch --vault <path> --path <file.md> [--content <text> | --content-file <file> | --stdin]');
    console.log('       edit --vault <path> --path <file.md> [--content <text> | --content-file <file> | --stdin]');
    console.log('       rename --vault <path> --source <path> --destination <path>');
    console.log('       move --vault <path> --source <path> --destination <path>');
    console.log('       inspect [--vault <path>]');
    console.log('       validate [--vault <path>]');
    console.log('       scan [--vault <path>]');
    console.log('       context [--vault <path>]');
    console.log('       doctor [--vault <path>]');
    console.log('       search [--vault <path>] [--query <text>] [--phrase <text>] [--tag <tag>]');
    console.log('       related [--vault <path>] [--path <note.md>] [--limit <n>]');
    console.log('       retrieve [--vault <path>] [--query <text>] [--tag <tag>] [--path <scope>] [--debug]');
    console.log('       agent-context [--vault <path>] [--query <text>] [--tag <tag>] [--path <scope-or-note>] [--debug]');
    console.log('       skills [--category <context|planning|execution|maintenance>]');
    console.log('       flows');
    console.log('       analyze-note [--vault <path>] [--path <note>] [--query <text>]');
    console.log('       prepare-edit-task [--vault <path>] [--path <note>] [--query <text>] [--tag <tag>]');
    console.log('       organize-batch [--vault <path>] [--path <scope>] [--query <text>]');
    console.log('       maintenance-diagnose [--vault <path>]');
    console.log('       prepare-writing-task [--vault <path>] [--path <note>] [--query <text>] [--tag <tag>]');
    console.log('       onboarding');
    console.log('       route-intent --query <text>');
    console.log('       product-context');
    console.log('       plan [--vault <path>] [--path <scope>] [--query <text>]');
    console.log('       diff [--vault <path>]');
    console.log('       sync');
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('Command failed: invalid configuration or response schema.');
      console.error(error.issues.map((issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`).join('\n'));
      process.exitCode = 1;
      return;
    }

    if (error instanceof Error) {
      const code = (error as Error & { code?: string }).code;
      console.error(`Command failed${code ? ` [${code}]` : ''}: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    console.error('Command failed: unknown error.');
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error('Command failed: unexpected runtime error.');
  if (error instanceof Error && error.message) {
    console.error(error.message);
  }
  process.exitCode = 1;
});
