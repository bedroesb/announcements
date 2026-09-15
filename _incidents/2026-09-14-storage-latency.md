---
title: Elevated latency on research storage volumes
start: 2026-09-14 08:20:00 +02:00
# No `end:` yet -> this incident is shown as ongoing at the top of the page.
severity: degraded
services_affected:
  - storage
  - galaxy
summary: >-
  Read and write operations on shared project volumes are noticeably slower
  than usual. Jobs still complete, but can take several times longer.
updates:
  - time: 2026-09-14 10:05:00 +02:00
    status: Identified
    body: >-
      One of the metadata servers is saturated after a failed failover. We are
      draining traffic to the healthy node.
  - time: 2026-09-14 08:40:00 +02:00
    status: Investigating
    body: >-
      We are aware of slow access to shared project storage and are looking
      into it.
---

Since early this morning, shared project volumes respond slowly to metadata
operations (listing directories, opening many small files). Sequential reads
and writes of large files are largely unaffected.

**Impact**

- Directory listings and file browsers can take tens of seconds.
- Galaxy jobs that read many small files run significantly slower.
- No data loss occurred, and no files are at risk.

**Workaround**

If you can, postpone jobs that traverse large directory trees until the
incident is resolved. Running jobs do not need to be cancelled.
