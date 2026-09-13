CREATE TABLE "EvidenceRequest" (
  "workspaceId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "key" VARCHAR(128) NOT NULL,
  "evidenceId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvidenceRequest_pkey" PRIMARY KEY ("workspaceId", "userId", "key"),
  CONSTRAINT "EvidenceRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EvidenceRequest_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
