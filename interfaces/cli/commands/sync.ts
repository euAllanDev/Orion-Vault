import { syncRegistry } from '../../../scripts/update-registry';

export async function executeSyncCommand(): Promise<void> {
  const updated = await syncRegistry();
  console.log(updated ? 'Registry updated.' : 'Registry already up to date.');
}
