import { EntityId } from '../../shared/value-objects/entity-id';
import { ValidationError } from '../../shared/errors/validation-error';

export type OrganizationActionKind = 'move-note' | 'create-folder';

export interface BaseActionProps {
  readonly id: string;
  readonly reason?: string;
}

export interface MoveNoteActionProps extends BaseActionProps {
  readonly sourcePath: string;
  readonly destinationPath: string;
}

export interface CreateFolderActionProps extends BaseActionProps {
  readonly folderPath: string;
}

export type OrganizationActionProps =
  | (MoveNoteActionProps & { readonly kind: 'move-note' })
  | (CreateFolderActionProps & { readonly kind: 'create-folder' });

export class OrganizationAction {
  public readonly id: EntityId;
  public readonly kind: OrganizationActionKind;
  public readonly reason?: string;
  public readonly sourcePath?: string;
  public readonly destinationPath?: string;
  public readonly folderPath?: string;

  constructor(props: OrganizationActionProps) {
    this.id = new EntityId(props.id);
    this.kind = props.kind;
    this.reason = props.reason?.trim() || undefined;

    if (props.kind === 'move-note') {
      if (!props.sourcePath.trim() || !props.destinationPath.trim()) {
        throw new ValidationError('Move action requires source and destination', 'ACTION_PATHS_REQUIRED');
      }

      this.sourcePath = props.sourcePath;
      this.destinationPath = props.destinationPath;
    }

    if (props.kind === 'create-folder') {
      if (!props.folderPath.trim()) {
        throw new ValidationError('Create-folder action requires folder path', 'ACTION_FOLDER_REQUIRED');
      }

      this.folderPath = props.folderPath;
    }

    Object.freeze(this);
  }

  static moveNote(props: MoveNoteActionProps): OrganizationAction {
    return new OrganizationAction({ ...props, kind: 'move-note' });
  }

  static createFolder(props: CreateFolderActionProps): OrganizationAction {
    return new OrganizationAction({ ...props, kind: 'create-folder' });
  }
}
