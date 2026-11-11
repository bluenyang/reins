# Design conversation — 2026-11-10 to 11: what building 0.3.1 made us think again

Korean edition: [2026-11-11_flow-audit-agents-md.ko.md](2026-11-11_flow-audit-agents-md.ko.md). Where the two disagree, the Korean file wins.

This folder keeps the maintainer's thinking while designing reins. The code and the design document hold only what was decided, so why it was decided, and what was hesitated over, is written down here. Quotations are the maintainer's words, translated from Korean (the Korean edition has them as they were said); the rest is the PM agent's account of the conversation.

One thing before reading: this document is not a rule. The rules in force are in the [design document](../design.md) and in the installed AGENTS.md and skills. Below, "decided" means it went into 0.3.1; "being considered" means it is in no version yet.

## Background

0.3.1 collects the follow-ups from the 0.3 retro (intent 021). Implementation and review went smoothly, but two audits after the merge kept making the same kind of finding: a work unit was added without showing the summary again, an exception was not written where exceptions belong, a commit message had no body. Each finding was right. But fixing them made new commits, the new commits were audited, and similar findings came back. Watching this, the maintainer said:

> "I think I am starting to see holes, little by little."

What follows is the conversation about what those holes are.

## Decided in 0.3.1, and why

### Check output per commit: not tied at commit time, filled in before the audit

The audit could not confirm that a commit passed its checks at the time. The first proposal had the hooks keep the check output under a content hash, and re-run the checks for every commit that a rebase made again. The maintainer asked back:

> "Does it have to use the commit hash? Can't it be done another way? It is only used at the audit anyway."

The record is used only by the audit, and a commit's content does not change, so whether it passes can be checked later with the same answer. So the hooks' logs are all there is in daily work, and for a commit without a log the PM runs the checks at that commit just before the audit. Daily work pays nothing extra; the cost falls only where it is needed.

### `.claude/settings.json`: always merged

reins and the user share this file. Only the deny rules made from the red lines are reins'. Asked whether to merge into a file that reins never wrote, the answer was short:

> "Yes. Always merge."

Both alternatives were judged wrong: red-line rules that stop being updated because the user added one permission, and a forced overwrite that drops the user's permissions.

### Fallback models: in, while reins still resolves nothing during work

0.3 removed the `fallback` key on purpose: reins is never called while a project works, so nothing could pick the fallback. The maintainer wanted it back ("let's try including fallback in 0.3.1"), and the principle stayed. When the settings name a fallback, `config` writes its call line into the delegation table ahead of time, and the PM follows that line when a call cannot be made. What decides at run time is a table a person can read and the agent that reads it.

### Finding the checks again

Once the gate script followed `gates.yaml`, the maintainer pointed at the gap straight away:

> "Right. config probably needs something like re-detecting the gates too."

A project changes, and `gates.yaml` is settled once at installation. So the checks are found again — and the differences are shown, and only what is picked is applied. A check written by hand is not touched.

### What was not confirmed is not written down as confirmed

`claude-fable-5-2` is an ID in the vendor's documentation and a model that is really served. But for one call, the output did not show which model had answered. The maintainer settled it:

> "Claude Fable 5.2 is in fact a model being served. So it can be chosen (a known model), but take it off the confirmed list."

"Known models" and "models seen working in this environment" are two lists. It stays on the first and left the second.

## Being considered 1: the flow

### The spec may be adjusted while working

Today's rule stops the work and asks for approval whenever the spec's work units change, however small the change. The maintainer thinks otherwise:

> "I prefer Scrum or XP to the waterfall model. When there is a problem, changing it is the right thing."
>
> "And it is not as if it would go unreported after the work."

Two cases:

> "Fairly important → pause the work, change the spec and get it approved."
>
> "There is a similar record already, or it is a small matter → go on and report afterwards."

For where the line runs, the PM proposed: adding or dropping a work unit, or changing its scope, stops for approval; a change of method inside a unit, and a small fix that comes out of a review or an audit, goes on and is reported afterwards. The maintainer said this matched what they had in mind.

### After the approvals it is one flow

> "What I want is this: once the intent and the spec have each been approved, from then on implementation, review, test, QA, PR and CI are one large continuous flow."
>
> "Unless something is wrong along the way, it should just keep going. That is what running the loop means to me."

This came from watching other projects that use reins keep asking for approval after the intent and the spec had been approved. The cause is in the rules: pushing and opening a PR count as "leaving the machine" and are asked about every time. The direction being considered: the approval of the intent and of the spec stay explicit, every time; after that nothing is asked until the PR is open and CI has finished; a merge and a stable release still wait for the maintainer's instruction.

## Being considered 2: the audit

### The audit catches everything; a person chooses what to accept

> "An audit is supposed to be something that does not let things slide."
>
> "Naturally it catches everything first, and then you choose what to accept flexibly."

So a looser flow may show more "wrongs" in the audit. The maintainer does not see that as the problem; what matters is how repeats are handled:

> "If this repeats three or four times or more, let's use knowledge to pass it even when the audit catches it."

A finding that has come up three or four times and was accepted each time would be written into knowledge as an accepted finding, and the audit would mark it as a known acceptance instead of a violation.

### Fixing something does not call for another audit

> "Being audited again and again just catches the same things."
>
> "I am not going to keep being audited just because something was put right."
>
> "Of course, if there was a somewhat critical problem and the change is large, an audit is right."
>
> "But for simply completing documents and records there is no real reason to be audited, is there?"

This is what happened in 0.3.1: when the commits holding the first audit's remedies were audited, new findings came out about the procedure of those remedies. Every audit leaves a commit of its own record, so repeating it never ends.

### Where the audit sits: the thinking changed once

Today's rule is "once, after the merge and before the rc". The maintainer first wanted it moved before the merge:

> "The audit runs once, after the loop. But before a release or a merge — that way a big problem can still block the merge."

When the PM asked to confirm that the audit would then look at the PR branch and the merge itself would fall outside it, the maintainer changed their mind:

> "I kept thinking of it as the first option, but on reflection the second would do: CI passes → first audit → merge and release → second audit, something like that."
>
> "The first audit is held fairly strictly, because of the risk; the second only needs to review the procedural side, since most of that part is done by tools anyway. Its result can go straight to the retro to be reviewed."

The two audits do different jobs. The first stands where it can still block the merge, so it looks at risk. The second comes when the merge and the release are over and nothing is left to block, and most of that stretch was done by tools (the PR, CI, the release workflow), so it looks at procedure only. What the second finds is not an order to fix something; it is material for the retro.

### An audit skims the history and orders corrections

> "Honestly, real audits do not go this far either. They skim the history and issue corrective orders."

The audits of 0.3.1 compared every commit with the sentences of the rules. The audit the maintainer has in mind is coarser: it goes through the history, finds the problems and says what to put right. How closely to look is to be settled together with the split into a first and a second audit.

## Being considered 3: what AGENTS.md holds

This came from looking at the AGENTS.md of other projects that use reins:

> "Maybe because of what was written there before, things like the current progress are written into it."

The AGENTS.md the maintainer has in mind:

> "The AGENTS I think of is somewhat broad and large-scale — the final goal? It states the goal of the project itself; the goal of the current work should not be written there."
>
> "Because then the agent keeps reading that."
>
> "AGENTS gives the common rules, regulations, guides, the large-scale goal, what this project is, how it is structured and so on, and beyond that only the instructions that matter."

There are two reasons. An agent reads this file in every session, so "the current work" written there keeps being read after that work is over. And it is a committed file that a team shares.

> "So AGENTS should change little."
>
> "So that even when someone else takes my source code and uses it, there are few conflicts."

What changes often has places of its own:

> "That is what knowledge, .loctx for the individual, CONTRIBUTING and ROADMAP are for, as I see it."

So the first conversation after an installation or a migration has to change:

> "After a migration or an install, when the project is first set up, there has to be a stretch where AGENTS.md is written in conversation with the user. And a guide for AGENTS.md is needed too."
>
> "Even when an existing AGENTS.md or CLAUDE.md holds such content, the init after a migration or install should follow this guide."
>
> "Where needed, content has to be brought in from other files, or handed over from this file to others (ROADMAP, knowledge and so on) — a sorting-out of traffic. Isn't that what migrating a harness is?"

Onboarding today means filling in the project sections of AGENTS.md. Taken at these words, onboarding is sorting: what is mixed together in the existing files is separated by kind. The large-scale goal and the rules go to AGENTS.md, progress and plans to the roadmap, decisions and their reasons to knowledge, personal notes to `.loctx`. Migrating a harness, on this view, is not moving files but putting content where it belongs.

## Being considered 4: a working folder that is not a git repository

One of the maintainer's projects has a working folder that is not a git repository. Under it sit one public repository and one private repository, kept apart, and the agent works from the outer folder. For reasons of their own the two cannot be merged into one repository.

> "reins cannot migrate or install where there is no git repository. How should it be applied there?"

Looking at where reins leans on git: the code uses git in one place only, to find the root. The larger part is assumptions — that plans and audit records are committed, that the audit reads git history, that hooks, branches and PRs exist per repository. Three options came up. Installing in each inner repository splits the plan in two and exposes the records in the public repository. Allowing a folder without git weakens what approvals and audits rest on. Making the outer folder a private repository and giving reins a notion of "member repositories" needs a new feature. Of the third the maintainer said "it is possible, I suppose." Nothing is decided; it comes back in the version that applies reins to other repositories.

## Still open

- Which version takes what is "being considered" above.
- What the first and the second audit each read and judge, and how closely they look.
- The shape of an "accepted finding" in knowledge, and how the audit reads it.
- The shape of the AGENTS.md guide, and the criteria by which onboarding sends existing content to one file or another.
- How to support a working folder that is not a git repository.

## See also

- The plan and the verdicts of 0.3.1: [intent 021](../../.agents/intent/021_retro-knowledge-and-upkeep/intent.md), [the audit record](../../.agents/audit/0.3.1.md).
- The rules in force: the [design document](../design.md) §3 (flow, stops, audit), §5 (AGENTS.md).
- The plan by version: the [roadmap](../ROADMAP.md).
