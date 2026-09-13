"use client";

import { createContext, useContext } from "react";

type WorkspaceContextValue = {
  slug: string;
  name: string;
  role: string;
  userName: string;
  email: string;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceContextValue; children: React.ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("Workspace context is required.");
  return workspace;
}
