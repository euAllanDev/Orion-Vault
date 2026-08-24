import path from 'node:path';
import fs from 'node:fs/promises';

function normalizeVaultRelativePath(candidatePath: string): string {
  const normalized = String(candidatePath ?? '').replace(/\\/g, '/');
  if (path.posix.isAbsolute(normalized) || normalized.split('/').some((part) => !part || part === '..')) {
    throw new Error(`Path escapes vault boundary: ${candidatePath}`);
  }

  return normalized;
}

export function resolveWithinRoot(rootPath: string, candidatePath: string): string {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedCandidate = path.resolve(resolvedRoot, normalizeVaultRelativePath(candidatePath));

  if (!isInsideRoot(resolvedRoot, resolvedCandidate)) {
    throw new Error(`Path escapes vault boundary: ${candidatePath}`);
  }

  return resolvedCandidate;
}

export function isInsideRoot(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolveExistingAncestor(startPath: string): Promise<string> {
  let currentPath = path.resolve(startPath);

  while (true) {
    try {
      return await fs.realpath(currentPath);
    } catch {
      const parentPath = path.dirname(currentPath);

      if (parentPath === currentPath) {
        throw new Error(`Unable to resolve an existing ancestor for: ${startPath}`);
      }

      currentPath = parentPath;
    }
  }
}

export async function resolveExistingWithinRoot(rootPath: string, candidatePath: string): Promise<string> {
  const resolvedRoot = await fs.realpath(path.resolve(rootPath));
  const resolvedCandidate = await fs.realpath(path.resolve(resolvedRoot, normalizeVaultRelativePath(candidatePath)));

  if (!isInsideRoot(resolvedRoot, resolvedCandidate)) {
    throw new Error(`Path escapes vault boundary: ${candidatePath}`);
  }

  return resolvedCandidate;
}

export async function resolveCreatableWithinRoot(rootPath: string, candidatePath: string): Promise<string> {
  const resolvedRoot = await fs.realpath(path.resolve(rootPath));
  const resolvedCandidate = path.resolve(resolvedRoot, normalizeVaultRelativePath(candidatePath));
  const ancestorPath = await resolveExistingAncestor(path.dirname(resolvedCandidate));

  if (!isInsideRoot(resolvedRoot, ancestorPath)) {
    throw new Error(`Path escapes vault boundary: ${candidatePath}`);
  }

  return resolvedCandidate;
}
