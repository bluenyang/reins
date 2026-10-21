---
name: verify
description: Run every gate from .harness/project.toml and report one line per gate plus failing tails, matched against the failure catalog. Cheap; no code reading.
args: ''
model_invocable: true
---

Read `.harness/core/roles/verifier.md` and follow it. Run `python3 .harness/harness.py gate all --summary`.
