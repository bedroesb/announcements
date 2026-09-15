---
title: Single sign-on unavailable for about 40 minutes
start: 2026-09-05 13:12:00 +02:00
end: 2026-09-05 13:54:00 +02:00
severity: critical
services_affected:
  - authentication
  - galaxy
  - eln
  - helpdesk
summary: >-
  An expired signing certificate on the identity provider blocked all new
  logins. Existing sessions kept working.
---

A certificate used to sign SAML assertions expired without being rotated,
which made every service reject new login attempts.

**Resolution**

The certificate was renewed and redeployed to the identity provider, after
which logins recovered immediately.

**Follow-up**

- Certificate expiry is now monitored with a 30-day warning threshold.
- The rotation procedure was added to the on-call runbook.
