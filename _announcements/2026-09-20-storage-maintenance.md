---
title: Planned firmware upgrade of the storage controllers
start: 2026-09-20 18:00:00 +02:00
end: 2026-09-20 22:00:00 +02:00
type: maintenance
services_affected:
  - storage
  - file-transfer
summary: >-
  Storage controllers receive a firmware upgrade. Expect short interruptions
  of up to five minutes during the window.
---

During the maintenance window the storage controllers are upgraded one by one.
Each failover causes a pause of up to five minutes on the affected volumes.

**What to expect**

- Short hangs when reading or writing files; applications should recover on
  their own.
- File transfers that are running may need to be restarted.

We recommend not starting long-running jobs that write to shared storage
during this window.
