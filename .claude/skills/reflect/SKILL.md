---
name: reflect
description: Use at the end of a session to list what went wrong or took too long and propose the smallest edit to a skill or CLAUDE.md that would have prevented each one. It waits for the user's OK before applying anything.
---
1. Go back over this session. List each thing that went wrong or took too long: a failed worker check, a rework, a wrong assumption, a slow search. Give the evidence for each (the command, the output, or the turn).
2. For each one, propose the **smallest** edit that would have prevented it: one line in CLAUDE.md, an agent file, a skill or a doc. Show it as a diff and name the file.
3. Skip anything that a rule already covers or that happened only once and won't come back.
4. Stop and wait for the user's OK. Apply only the edits they approve, then note them in `docs/decisions.md`.
