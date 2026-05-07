import type { OrganizationAction, OrganizationActionKind } from '../entities/action';

export const allowedOrganizationActionKinds: readonly OrganizationActionKind[] = ['move-note', 'create-folder'];

export function isAllowedOrganizationAction(action: OrganizationAction): boolean {
  return allowedOrganizationActionKinds.includes(action.kind);
}
