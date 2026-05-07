export const desktopIpcChannels = {
  setup: 'desktop:setup',
  workspace: 'desktop:workspace',
  vault: 'desktop:vault',
  file: 'desktop:file',
  folder: 'desktop:folder',
  note: 'desktop:note'
} as const;

export type DesktopIpcChannel = typeof desktopIpcChannels[keyof typeof desktopIpcChannels];
