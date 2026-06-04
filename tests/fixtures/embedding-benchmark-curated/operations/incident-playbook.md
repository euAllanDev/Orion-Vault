# Incident Playbook

## Status Communication

During an incident, the operator gives short updates, names the affected capability, states the current level of confidence, and avoids pretending the diagnosis is complete before evidence exists. This section is useful, but communication alone does not restore service.

## Triage Path

When the service becomes unstable, the operator inspects recent changes, narrows the fault to the smallest plausible surface, verifies rollback safety, and chooses the least dangerous path back to a safe operating state. The core playbook is about restoring service safely without widening the blast radius while the diagnosis is still incomplete.

## Rollback Decision

Rollback is preferred when a recent change is strongly correlated with the failure and the revert path is known to be safer than continued live debugging. The playbook emphasizes concrete action thresholds, not just terminology, so the team can stop digging the hole deeper while pressure is high.

## Recovery Steps

After the immediate fault is contained, the operator confirms health signals, validates customer-facing behavior, and records what was tried. The note focuses on triage, rollback decisions, and practical steps for bringing the system back without expanding the incident scope.
