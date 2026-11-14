# What AGENTS.md holds

AGENTS.md is read by every agent at the start of every session, and by everyone who takes the project's source. Keep it short and slow to change: it describes the project and its standing rules, not the work of the day. This guide is for the project sections — everything outside the `reins:` blocks, which reins writes.

## What belongs

- What the project is, in a few lines.
- Its goals and scope — the overall ones, the reason the project exists.
- Its structure: where things are.
- The stack and the commands to build, check and run it.
- Common rules and conventions that hold for all work (branches, commits, documents, review).
- Red lines: paths not to touch, secret files, actions never taken.
- The important instructions that must keep being followed.

## What does not, and where it goes

| It is | It goes to |
|---|---|
| the current work, progress, what is done and what is next | the roadmap: `docs/ROADMAP.md` when settled, `.loctx/ROADMAP.local.md` for ideas |
| a plan for one version | the roadmap, then that version's intent and spec |
| a decision and its reason | a knowledge candidate for `.agents/knowledge/` — proposed, written when the user accepts it |
| a decision made once, for one piece of work | that work's intent or spec, or `.loctx/history/<version>.md` |
| personal notes, this machine's settings | `.loctx/` |
| how to contribute | `CONTRIBUTING.md` |
| a long explanation of the design | a document under `docs/`, linked from AGENTS.md in one line |

## Rules of thumb

- If a line will be wrong next month, it does not belong here.
- An instruction the user gave once for one item is not a rule. Write a rule only when the user said it is one.
- Prefer a pointer to a file over a copy of its content.
- When you move something out, tell the user what went where; knowledge is only proposed, never written without their word.
