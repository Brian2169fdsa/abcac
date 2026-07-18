# 05 — Pull Request Disposition (all 155 PRs, verified with git)

> **The question:** "there are a lot of open PRs where I feel most of my building is sitting —
> is it already done, old crap, or good build needing to be deployed?"
>
> **The answer, proven against git history (2026-07-16):** your building is **NOT sitting in PRs —
> it is merged.** Of **155 total PRs, 150 are merged into `main`**. Only **4 are open**, and **3 of
> those are stale duplicates of work already merged** — merging them would move the platform
> *backward*. Exactly **1** closed PR ever had its work dropped (#13, a June 7 hero-styling tweak,
> superseded the same week).

**Method:** full PR list pulled from the GitHub API (`merged_at` per PR), then each open/unmerged
PR's head commit compared against `origin/main` with `git merge-base` / `git diff` — so this is
measured, not guessed.

---

## The 4 open PRs — what to do with each

### ❌ #150 — "feat(admin): add AI Agent workspace tab…" → **recommend CLOSE**
- Branch `claude/agent-admin-workspace`, **82 commits behind main**.
- Adds the **mock-data** ("scripted artifacts") version of the admin AI Agent workspace
  (+1,499 lines incl. `src/lib/mock/agent-data.ts`).
- `main` already merged the **newer, real-data** iteration of the same workspace
  (#149 *"AI Agent: wire workspace + chat to real analytics, add Trends panel"*).
- Merging #150 would overwrite newer work with the older demo version.
- **Action:** close unmerged. The remaining real work here is finishing the live-data wiring in
  `main` (see `02-code-work.md` item C1), not merging this PR.

### ❌ #153 — "Member write-side: uploads, dynamic verify select, supervision, member messaging" → **recommend CLOSE**
- Branch `claude/portal-member-writes` has **no merge base with main** — it was built on the
  ancient pre-rewrite history (its commit list includes June Phase-0 commits like the old
  GAP-ANALYSIS docs). **120 commits behind.**
- Everything in its title already exists in `main` (member document upload, dynamic verification
  cert select, supervision records, two-way messaging — all verified present).
- It cannot even be merged normally (no common ancestor).
- **Action:** close unmerged.

### ❌ #155 — "Mobile-optimize global site chrome and layout primitives" → **recommend CLOSE**
- Exact same title as **#126, merged 2026-06-09**. **94 commits behind main.**
- Verified by diff: merging it would **regress** main — it would *remove* the mobile-drawer
  containing-block fix (#131) and *remove* the "Counselor Directory" footer link. Main's version of
  all 4 files it touches is strictly newer.
- **Action:** close unmerged.

### ✅ #151 — "docs: Ship Plan" (this assessment) → keep open, review & merge
- Docs only; adds `SHIP-PLAN.md` + `docs/ship/*`. Vercel preview builds green.

> **Why do stale duplicates keep appearing?** #150/#153/#155 were opened from old session branches
> (the repo still carries ~150 `claude/*` remote branches from past sessions). Old branches get
> re-pushed/re-opened and look like pending work. **Recommendation:** after closing the three PRs,
> bulk-delete the merged `claude/*` branches (GitHub → Branches → delete merged), and turn on
> GitHub's "Automatically delete head branches" setting so this stops recurring.

---

## Merged work — the platform WAS built through PRs, and it landed

All ~150 merged PRs, grouped (proof that the big systems are in `main`, not pending):

| Theme | PRs (examples) |
|---|---|
| Site build-out, content, mobile passes | #1–50, #63–64, #126–131 |
| Member portal parity + chrome (sidebar, KPI, dashboard) | #66–74, #77, #82–85, #89 |
| Admin console + member 360° cockpit + parity B1–B8 | #76, #81, #86, #90–91, #119–125, #154 |
| Roles/superadmin foundation | #75, #79–80 |
| AI assistant (member/admin/website) + rich chat + rate limits | #54–55, #62, #98–100, #108–111 |
| Reminders engine + runbook | #92–94 |
| Test waves (payments, cron, exports, assistant, admin actions) | #102–107, #152 |
| Security & bug-fix waves (assessment blockers, guards, contrast) | #56, #101, #113–117 |
| Automation engine Phases 0–1 + config + digest + vision + analytics | #132–142 |
| Notifications, activity, public directory/verification | #143–144 |
| Auth/login fixes, red-team fixes, real-data agent wiring | #145–149 |

**Closed without merge and genuinely lost:** only **#13** ("Hero: full-width, larger image…",
2026-06-07) — cosmetic, superseded by later hero work the same week. Nothing else was dropped.

---

## Verified health of `main` after today's merges (#152, #154)

- Merged tip: `e12669c`. `tsc --noEmit` **clean**; **936 tests / 73 files green**.
- Reminder: there is **no CI on this repo** — these checks ran locally for this report. Adding CI
  (see `02-code-work.md` C4) is what prevents a future stale-branch merge (like #155 would have
  been) from silently regressing `main`.

## Bottom line

There is **no reservoir of unshipped building sitting in PRs.** The build is in `main`. The gap you
feel is explained by: (1) the three stale open PRs *looking* like pending work, (2) the June
planning docs describing a much less finished platform than the code actually is, and (3) the real
remaining items — owner config (Stripe/keys/domain), the four mock-data surfaces, legacy portal
retirement, and legal pages — documented in `SHIP-PLAN.md` and `docs/ship/01–04`.
