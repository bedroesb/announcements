---
title: Galaxy jobs failing on the compute cluster
start: 2026-08-21 09:00:00 +02:00
end: 2026-08-21 16:30:00 +02:00
severity: degraded
services_affected:
  - galaxy
summary: >-
  A subset of jobs failed immediately after submission because of a full
  scratch partition on two compute nodes.
---

Two compute nodes ran out of scratch space, causing jobs scheduled on them to
fail within seconds of starting. Resubmitting usually landed the job on a
healthy node.

**Resolution**

Stale scratch directories were cleaned up and a nightly clean-up job now runs
on all compute nodes.
