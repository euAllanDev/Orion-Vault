import { executeContextCommand } from './commands/context';
import { executeDiffCommand } from './commands/diff';
import { executeDoctorCommand } from './commands/doctor';
import { executePlanCommand } from './commands/plan';
import { executeScanCommand } from './commands/scan';
import { executeSearchCommand } from './commands/search';
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
import { ZodError } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv: string[]) {
  const command = argv[0] ?? 'help';
  const readOption = (name: string): string | undefined => {
    const index = argv.findIndex((arg) => arg === name);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  const dryRun = argv.includes('--dry-run');
  const vaultRoot = readOption('--vault');
  const query = readOption('--query');
  const phrase = readOption('--phrase');
  const pathValue = readOption('--path');
  const source = readOption('--source');
  const destination = readOption('--destination');
  const content = readOption('--content');
  const limit = readOption('--limit');
  const valueOptions = new Set(['--vault', '--query', '--phrase', '--path', '--source', '--destination', '--content', '--tag', '--limit']);
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

  return { command, vaultRoot, dryRun, query, phrase, path: pathValue, source, destination, content, limit, tags: tagValues, plainArgs };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const slashCommand = args.command.startsWith('/') ? args.command.slice(1) : args.command;
  const positionalInput = (args.plainArgs[0] ?? '').trim();

  try {
    if (slashCommand === 'organize' || slashCommand === 'preview') {
      await executeOrganizeCommand({ vaultRoot: args.vaultRoot, dryRun: true });
      return;
    }

    if (slashCommand === 'guide') {
      const guidePath = path.resolve('comandos.md');
      const content = await fs.readFile(guidePath, 'utf8');
      console.log(content);
      return;
    }

    if (slashCommand === 'apply') {
      await executeOrganizeCommand({ vaultRoot: args.vaultRoot, dryRun: false });
      return;
    }

    if (args.command === 'organize') {
      await executeOrganizeCommand({ vaultRoot: args.vaultRoot, dryRun: args.dryRun });
      return;
    }

    if (args.command === 'mkdir') {
      await executeCreateFolderCommand({ vaultRoot: args.vaultRoot, path: args.path });
      return;
    }

    if (args.command === 'touch') {
      await executeCreateFileCommand({ vaultRoot: args.vaultRoot, path: args.path, content: args.content });
      return;
    }

    if (args.command === 'edit') {
      await executeEditCommand({ vaultRoot: args.vaultRoot, path: args.path, content: args.content });
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
      await executeContextCommand({ vaultRoot: args.vaultRoot, path: args.path ?? (positionalInput || undefined) });
      return;
    }

    if (args.command === 'context') {
      await executeContextCommand({ vaultRoot: args.vaultRoot, path: args.path });
      return;
    }

    if (args.command === 'doctor') {
      await executeDoctorCommand({ vaultRoot: args.vaultRoot });
      return;
    }

    if (slashCommand === 'search') {
      await executeSearchCommand({ vaultRoot: args.vaultRoot, query: args.query ?? (positionalInput || undefined), phrase: args.phrase, tags: args.tags });
      return;
    }

    if (slashCommand === 'related') {
      await executeRelatedCommand({ vaultRoot: args.vaultRoot, path: args.path ?? (positionalInput || undefined), limit: args.limit ? Number.parseInt(args.limit, 10) : undefined });
      return;
    }

    if (args.command === 'search') {
      await executeSearchCommand({ vaultRoot: args.vaultRoot, query: args.query, phrase: args.phrase, tags: args.tags });
      return;
    }

    if (args.command === 'related') {
      await executeRelatedCommand({ vaultRoot: args.vaultRoot, path: args.path ?? (positionalInput || undefined), limit: args.limit ? Number.parseInt(args.limit, 10) : undefined });
      return;
    }

    if (slashCommand === 'plan') {
      await executePlanCommand({ vaultRoot: args.vaultRoot });
      return;
    }

    if (slashCommand === 'preview') {
      await executePlanCommand({ vaultRoot: args.vaultRoot });
      return;
    }

    if (args.command === 'plan') {
      await executePlanCommand({ vaultRoot: args.vaultRoot });
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
    console.log('       /guide');
    console.log('       /context [--vault <path>] [--path <note>]');
    console.log('       /search [--vault <path>] [--query <text>] [--phrase <text>] [--tag <tag>]');
    console.log('       /related [--vault <path>] [--path <note.md>] [--limit <n>]');
    console.log('       /plan [--vault <path>]');
    console.log('       /preview [--vault <path>]');
    console.log('       /apply [--vault <path>]');
    console.log('       mkdir --vault <path> --path <folder>');
    console.log('       touch --vault <path> --path <file.md> [--content <text>]');
    console.log('       edit --vault <path> --path <file.md> --content <text>');
    console.log('       rename --vault <path> --source <path> --destination <path>');
    console.log('       move --vault <path> --source <path> --destination <path>');
    console.log('       inspect [--vault <path>]');
    console.log('       validate [--vault <path>]');
    console.log('       scan [--vault <path>]');
    console.log('       context [--vault <path>]');
    console.log('       doctor [--vault <path>]');
    console.log('       search [--vault <path>] [--query <text>] [--phrase <text>] [--tag <tag>]');
    console.log('       related [--vault <path>] [--path <note.md>] [--limit <n>]');
    console.log('       plan [--vault <path>]');
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
