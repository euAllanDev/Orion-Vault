CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE "WorkspacePlan" AS ENUM ('FREE', 'PRO');
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'RESEARCHER', 'VIEWER');
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'DECLINED');
CREATE TYPE "SessionMethod" AS ENUM ('INTERVIEW', 'OBSERVATION', 'USABILITY_TEST');
CREATE TYPE "SessionStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "EvidenceKind" AS ENUM ('QUOTE', 'OBSERVATION', 'NOTE');
CREATE TYPE "ThemeConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "User" (
  "id" UUID NOT NULL,
  "email" CITEXT NOT NULL,
  "name" VARCHAR(120),
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Workspace" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "plan" "WorkspacePlan" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
  "workspaceId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "MembershipRole" NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("workspaceId", "userId")
);

CREATE TABLE "Project" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "objective" TEXT NOT NULL,
  "status" "ProjectStatus" NOT NULL,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Participant" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "displayName" TEXT NOT NULL,
  "consentStatus" "ConsentStatus" NOT NULL,
  "metadata" JSONB NOT NULL,
  CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "participantId" UUID,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "method" "SessionMethod" NOT NULL,
  "status" "SessionStatus" NOT NULL,
  "guide" TEXT,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Evidence" (
  "id" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "kind" "EvidenceKind" NOT NULL,
  "timestampSeconds" INTEGER,
  "tags" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Evidence_text_length_check" CHECK (char_length("text") BETWEEN 1 AND 5000),
  CONSTRAINT "Evidence_tags_count_check" CHECK (cardinality("tags") <= 10)
);

CREATE TABLE "Theme" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "confidence" "ThemeConfidence" NOT NULL,
  CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThemeEvidence" (
  "themeId" UUID NOT NULL,
  "evidenceId" UUID NOT NULL,
  CONSTRAINT "ThemeEvidence_pkey" PRIMARY KEY ("themeId", "evidenceId")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
CREATE INDEX "Project_workspaceId_status_idx" ON "Project"("workspaceId", "status");
CREATE INDEX "Session_projectId_scheduledAt_idx" ON "Session"("projectId", "scheduledAt");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Theme" ADD CONSTRAINT "Theme_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ThemeEvidence" ADD CONSTRAINT "ThemeEvidence_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThemeEvidence" ADD CONSTRAINT "ThemeEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION "ensure_theme_evidence_same_project"() RETURNS TRIGGER AS $$
DECLARE
  theme_project_id UUID;
  evidence_project_id UUID;
BEGIN
  SELECT "projectId" INTO theme_project_id FROM "Theme" WHERE "id" = NEW."themeId";
  SELECT session_record."projectId" INTO evidence_project_id
  FROM "Evidence" evidence_record
  JOIN "Session" session_record ON session_record."id" = evidence_record."sessionId"
  WHERE evidence_record."id" = NEW."evidenceId";

  IF theme_project_id IS NULL OR evidence_project_id IS NULL OR theme_project_id <> evidence_project_id THEN
    RAISE EXCEPTION 'Theme and evidence must belong to the same project';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ThemeEvidence_same_project_trigger"
BEFORE INSERT OR UPDATE OF "themeId", "evidenceId" ON "ThemeEvidence"
FOR EACH ROW EXECUTE FUNCTION "ensure_theme_evidence_same_project"();
