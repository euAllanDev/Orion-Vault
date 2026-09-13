ALTER TABLE "EvidenceRequest"
  DROP CONSTRAINT "EvidenceRequest_evidenceId_fkey",
  ADD CONSTRAINT "EvidenceRequest_evidenceId_fkey"
    FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
