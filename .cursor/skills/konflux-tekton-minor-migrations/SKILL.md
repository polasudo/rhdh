---
name: konflux-tekton-minor-migrations
description: >-
  Deprecated stub. Use konflux-tekton-updates from redhat-developer/rhdh-skill instead.
disable-model-invocation: true
---

# Moved to rhdh-skill

This skill lives upstream: [konflux-tekton-updates](https://github.com/redhat-developer/rhdh-skill/tree/main/skills/konflux-tekton-updates)

```bash
npx skills add redhat-developer/rhdh-skill --skill konflux-tekton-updates
```

Then ask your agent to apply Konflux `MIGRATION.md` steps after `./updateDigests.sh --minor --no-push`.
