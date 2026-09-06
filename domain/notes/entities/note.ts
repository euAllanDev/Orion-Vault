import { EntityId } from '../../shared/value-objects/entity-id';
import { ValidationError } from '../../shared/errors/validation-error';
import { NotePath } from '../value-objects/note-path';

export interface NoteProps {
  readonly id: string;
  readonly path: string;
  readonly content: string;
  readonly title?: string;
  readonly tags?: readonly string[];
  readonly mtime?: number;
}

export class Note {
  public readonly id: EntityId;
  public readonly path: NotePath;
  public readonly content: string;
  public readonly title?: string;
  public readonly tags: readonly string[];
  public readonly mtime?: number;

  constructor(props: NoteProps) {
    if (!props.content.trim()) {
      throw new ValidationError('Note content cannot be empty', 'NOTE_CONTENT_EMPTY');
    }

    this.id = new EntityId(props.id);
    this.path = new NotePath(props.path);
    this.content = props.content;
    this.title = props.title?.trim() || undefined;
    this.tags = Object.freeze([...(props.tags ?? [])]);
    this.mtime = props.mtime;
    Object.freeze(this);
  }

  static create(props: NoteProps): Note {
    return new Note(props);
  }
}
