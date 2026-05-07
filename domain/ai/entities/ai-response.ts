export interface AIResponseAction {
  readonly kind: 'move-note' | 'create-folder';
  readonly id: string;
  readonly reason?: string;
  readonly sourcePath?: string;
  readonly destinationPath?: string;
  readonly folderPath?: string;
}

export interface AIResponse {
  readonly provider: string;
  readonly summary?: string;
  readonly actions: readonly AIResponseAction[];
}
