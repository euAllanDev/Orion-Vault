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
import { ZodError } from 'zod';

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

  const tagValues = [] as string[];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--tag' && argv[index + 1]) {
      tagValues.push(...argv[index + 1].split(',').map((value) => value.trim()).filter(Boolean));
    }
  }

  return { command, vaultRoot, dryRun, query, phrase, path: pathValue, source, destination, content, tags: tagValues };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  try {
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

    if (args.command === 'context') {
      await executeContextCommand({ vaultRoot: args.vaultRoot });
      return;
    }

    if (args.command === 'doctor') {
      await executeDoctorCommand({ vaultRoot: args.vaultRoot });
      return;
    }

    if (args.command === 'search') {
      await executeSearchCommand({ vaultRoot: args.vaultRoot, query: args.query, phrase: args.phrase, tags: args.tags });
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
