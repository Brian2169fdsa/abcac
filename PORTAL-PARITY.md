# Portal Parity Audit — Static Portal vs Next.js App

Goal: rebuild the Next.js member/admin portal (`src/app/(portal)` + `src/app/(admin)`) so it **looks and functions like** the original static portal (`public/portal/*`). This document is the read-only audit + build plan. No code was changed.

**Reference files**

| Side | Static (target look) | Next.js (keeper codebase) |
|---|---|---|
| Member shell | `public/portal/index.html` | `src/app/(portal)/layout.tsx`, `src/components/portal-nav.tsx` |
| Member logic | `public/portal/js/portal.js` | `src/app/(portal)/account/**` |
| Admin shell | `public/portal/admin.html` | `src/app/(admin)/admin/layout.tsx`, `src/components/admin/admin-nav.tsx` |
| Admin logic | `public/portal/js/admin.js` | `src/app/(admin)/admin/**` |
| Tokens | inline `:root` in each HTML | `src/app/globals.css`, `tailwind.config.ts`, `src/app/layout.tsx` |

**TL;DR** — The Next.js portal is *functionally at or ahead of* the static one on nearly every surface (it even adds reciprocity payments, two-way supervision, document-requests, a schedule engine, a public verifier, Stripe checkout, and an AI assistant). The real gap is **structural/visual**: the static portal is a **grouped left-sidebar + home-dashboard** experience; the Next.js portal is a **flat horizontal top-tab bar with a long-scroll home page**. Closing parity is ~80% layout/IA work and ~20% filling a handful of small feature holes (KPI cards, recent-activity feed, notification preferences, certificate "Active" banner).

---

## 1. Layout / navigation gap

### Static member portal (target)
Three stacked fixed bars + a fixed left sidebar (`index.html` lines 50–214):

- **Top bar** (maroon `--navy #7B1A1A`, 48px): right-aligned user avatar, name, message badge, sign-out (`.topbar`).
- **Brand bar** (white, 48px down): 48px logo + Playfair "ABCAC" title + subtitle (`.brandbar`).
- **Left sidebar** (`.sidebar-nav`, 280px, fixed, white, gold active indicator via `border-left`), **grouped**:
  - `Home`
  - **Profile**: Personal Information · Employment Information · Certificate & Wallet Card · Other Certifications
  - **Certification**: Apply for Certification · Document Upload · Continuing Education Unit Tracker · Certification Renewal · Authorizations: Clinical Supervision
  - **Requests**: Name Change Request · Verification of Certification · IC&RC Reciprocity Request
  - (divider) Messages (with red unread badge) · Invoices & Receipts · Account Settings
- **Main content** (`.main-content`, `margin-left:280px`): SPA-style `.page` sections toggled by `nav()`.
- **Home dashboard** (`#page-home`, lines 1297–1350): welcome banner ("Welcome back, {name}") → **4 KPI stat cards** (Active Certifications · CEUs Completed _x/40_ · Next Renewal · IC&RC Status) → reminder note box → **6 quick-action tiles** (Log CEU Hours, Renew Certification, View Certificate, Upload Documents, IC&RC Transfer, Messages) → **Recent Activity timeline** card (last 5 events across CEU/applications/invoices, dotted timeline).

### Next.js member portal (current)
- `(portal)/layout.tsx` renders the **public marketing `SiteHeader`/`SiteFooter`** + `PortalNav` + the AI `ChatWidget`. There is **no portal-specific top/brand bar** and **no sidebar**.
- `PortalNav` (`src/components/portal-nav.tsx`) is a **single horizontal, horizontally-scrolling tab strip** of **14 flat, ungrouped tabs** (Overview, Applications, Certifications, CEU Tracker, Documents, Experience, Apply, Recertify, Renewals, Requests, Invoices, Messages, Profile, Settings). No section headers, no grouping, no maroon, no unread badge.
- The home page `(portal)/account/page.tsx` is a **long vertical scroll** of `PageHero` + stacked `Section` blocks (action-items, profile completeness, quick-actions grid, credentials grid, sync, payment history). It has quick-action cards but **no KPI stat-card row** and **no recent-activity timeline**.

### What it takes to match
1. **New portal chrome**: replace the marketing `SiteHeader` in `(portal)/layout.tsx` with a portal-specific maroon top bar + white brand bar, and add a fixed **grouped left sidebar** component (`PortalSidebar`) that mirrors the static groups/labels exactly. Keep the AI `ChatWidget`.
2. **Restructure nav** from flat tabs → grouped sidebar (Home / Profile / Certification / Requests / + Messages/Invoices/Settings). Map existing routes onto the static labels (see §2). Add the **unread-message badge** on the Messages item.
3. **Rebuild the home dashboard** (`account/page.tsx`) to: welcome banner → **4 KPI cards** → reminder note → **quick-action tile grid** → **recent-activity timeline**. The data for all four KPIs and the timeline already exists in the loaders (certifications, ceu_records via `computeCompliance`, payments, applications) — it's a presentation rebuild, not new data plumbing.
4. **Admin**: static admin uses a **maroon full-height left sidebar** (`admin.html` `.sidebar` 240px) with per-item **count badges**. Next.js admin uses a **maroon top header + horizontal tab bar** (`admin/layout.tsx` + `admin-nav.tsx`) **without count badges**. To match: move AdminNav into a left sidebar and surface pending counts as badges on the nav items (counts already computed in `admin/page.tsx`).

---

## 2. Per-surface feature parity table

Priority: **H** = needed for visual/functional parity, **M** = nice for parity, **L** = cosmetic.

### Member surfaces

| Surface | Static has | Next.js has | GAP / difference | Pri |
|---|---|---|---|---|
| **Nav / IA** | Grouped left sidebar (Home/Profile/Certification/Requests + extras), maroon top+brand bars, unread badge | Flat 14-tab horizontal bar, marketing header, no badge | Rebuild as grouped sidebar + portal chrome + Messages badge | **H** |
| **Home / Dashboard** | Welcome banner, 4 KPI cards (Active Certs, CEUs x/40, Next Renewal, IC&RC Status), reminder note, 6 quick tiles, Recent Activity timeline | PageHero, action-items, profile %, 4 quick-action cards, credentials grid, sync, payment table | Missing: KPI stat-card row; Recent-Activity timeline. (Data already loaded) | **H** |
| **Personal Information** | First/Middle/Last, Email(disabled), Phone, DOB, Last-4 SSN, Address, City, State, Zip; Save | `account/profile` (profile fields + settings) | Verify field-for-field (Middle Name, DOB, Last-4 SSN). Likely present; confirm | **M** |
| **Employment Information** | Table: Employer, Position/Title, Start, End, Status; +Add row | `account/experience` "Employment History" table + Add/Edit forms | Static has a **Status** column; Next.js shows Present/dates. Add status if desired | **L** |
| **Certificate & Wallet Card** | Green "Active — good standing" banner; table: Certification, Cert #, Issued, Expiration, IC&RC Level, Actions (download cert + wallet) | `account/certifications` table same columns | Missing the green "Active / good standing" status banner; verify wallet-card download action | **M** |
| **Other Certifications** | Table: Title, Credential #, Issuing Board, Issued, Expiration; +Add | `account/experience` "Other Certifications" table + Add form (also doc upload) | Parity (Next.js adds Document column) | — |
| **Apply for Certification** | New-application form (App Type, Certification select) + Application History table (Type, Cert, Submitted, Est. Completion, Status) | `account/apply` form + `account/applications` history | Split across two routes; in static it's one page. Acceptable; map both under "Certification" group | **L** |
| **Document Upload** | Uploaded-docs table (Name, Type, Date, Status, Actions) + upload form (Doc Type select, Related Cert, file) | `account/documents` upload + list (+ doc-requests from admin) | Parity or ahead | — |
| **CEU Tracker** | 4 stat cards (Total x/40 + progress bar, Ethics x/3, Cultural x/3, Remaining), records table, "Log CEU Hours" **modal** | `account/ceus` (compliance engine, schedule-aware totals) | Verify the **progress bars + 4-stat layout + modal** UX matches; data ahead (schedule-driven) | **M** |
| **Certification Renewal** | Eligible table (Cert, #, Expiration, CEU Status, Fee, Actions) + Certification Sync card ($15/mo) | `account/renewals` + `account/renew` + sync on home | Split across routes; sync present. Confirm renewal-eligibility table | **L** |
| **Authorizations: Clinical Supervision** | Table: Supervisee, Credential, Start, End, Status; +Add | `account/experience` "Clinical Supervision" + **also "Supervision You Receive"** | Ahead (two-way). Different home (lives under Experience) | — |
| **Name Change Request** | Form: Current(disabled), New, Reason select, supporting doc upload; + (no history shown) | `account/requests` NameChangeForm + history list w/ doc view | Parity / ahead | — |
| **Verification of Certification** | Form: Cert select, Purpose select, Recipient name/email, notes | `account/requests` VerificationForm (dynamic cert options) + history | Parity / ahead | — |
| **IC&RC Reciprocity** | Transfer-OUT form, Transfer-INTO info card, IC&RC International Certificate order card | `account/requests` ReciprocityForm (direction in/out, **payment status**) + history | Ahead (adds $150 fee tracking). Missing the "Order IC&RC International Certificate" CTA card | **M** |
| **Messages** | Inbox card (list) | `account/messages` (read + send back) | Parity / ahead | — |
| **Invoices & Receipts** | Table: Invoice #, Description, Date, Amount, Status, Actions | `account/invoices` + payment history on home | Parity | — |
| **Account Settings** | Login (email disabled, Change Password modal), **Notification Preferences** (4 toggles: Renewal, CEU, Announcements, IC&RC), Danger Zone (deactivation mailto) | `account/settings` (credentials, password) | Missing: **Notification Preferences toggles** + Danger-Zone deactivation block | **M** |

### Admin surfaces

| Surface | Static has | Next.js has | GAP / difference | Pri |
|---|---|---|---|---|
| **Nav / shell** | Maroon **left sidebar** (240px) w/ **count badges** per queue | Maroon **top header + horizontal tab bar**, **no count badges** | Convert to left sidebar + add count badges (counts already computed) | **H** |
| **Dashboard** | 6 stat tiles (Docs, CEUs, Apps open, Requests, Approvals, Members) | Stat tiles + revenue, expiring-soon list (`admin/page.tsx`) | Ahead | — |
| **Account Approvals** | Table (Member, Email, Phone, Certs, Submitted) + Approve/Reject + notes | `admin/approvals` + `approve-account.ts` | Parity | — |
| **Document Review** | Table (Member, Type, File, Uploaded, Status) + Approve/Reject/Reopen + notes | `admin/documents` | Parity | — |
| **CEU Review** | Table (Member, Course, Provider, Hrs, Category, Completed, Cert, Status) + review | `admin/ceus` | Parity | — |
| **Applications** | Table + status editor (submitted/under_review/approved/rejected) + est. completion | `admin/applications` | Parity | — |
| **Requests** | 3 tables (Name Change, Verification, Reciprocity) + complete/reject/reopen | `admin/requests` + `decide-request.ts` + `decide-verification.ts` | Parity | — |
| **Members** | Search + table (Name, Email, Cert Status, Role, Joined) + Manage modal | `admin/members` + `members/[id]` + `admin/search` | Ahead | — |
| **Send Message** | Member select + subject + body | `admin/messaging` | Parity | — |
| **Create Invoice** | Member select + description + amount | `admin/invoices` | Parity | — |
| **(Next.js-only)** | — | Reports, Finance, Compliance, Schedules, Announcements, Audit Log | Keep — net-new admin value | — |

---

## 3. Visual / UX differences

| Aspect | Static (target) | Next.js (current) | Action |
|---|---|---|---|
| **Primary maroon** | `--navy #7B1A1A` | `--brand #7b1a1a` | **Match** ✅ |
| **Gold accent** | `--gold #C5A55A` | `--accent #c8a04a` | Near-match; align to `#C5A55A` if exact parity wanted (L) |
| **Display font** | Playfair Display (serif) | Sora (sans, `--font-sora`) | Static headings are **serif**; Next.js is sans. Decide: adopt Playfair for portal headings or accept Sora (M) |
| **Body font** | DM Sans | Source Sans 3 (`--font-body`) | Different but both clean sans; low impact (L) |
| **Portal chrome** | Maroon top bar + white brand bar + 280px sidebar | Marketing site header + flat tab bar | Build portal chrome + sidebar (H) — see §1 |
| **Cards** | white, `--radius 12px`, soft maroon-tinted shadow, gray-50 card headers | rounded-xl border-line surface | Mostly aligned; add card-header band + maroon-tinted shadow for fidelity (L) |
| **Active nav indicator** | gold `border-left` + pale-gold bg | brand `border-bottom` (tabs) | Re-implement as sidebar gold left-border active state (H) |
| **Status badges** | pill badges: green/amber/red/blue/gray with dot | `capitalize` text / outline pills | Standardize a Badge component matching static colors (M) |
| **Home hero** | Welcome banner + KPI cards + tiles + timeline | PageHero + sections | Rebuild dashboard (H) — see §1/§2 |
| **Admin shell** | maroon left sidebar w/ count badges | maroon top bar + tabs | Sidebar + badges (H) |

---

## 4. Build plan (disjoint work packages for parallel agents)

Packages are file-scoped and mostly non-overlapping so they can run in parallel. **WP-1** (chrome/tokens) should land first since others depend on the shell; the rest are independent.

**WP-1 — Member portal chrome + sidebar (foundation, do first)**
- Files: `src/app/(portal)/layout.tsx`; new `src/components/portal/portal-topbar.tsx`, `portal-brandbar.tsx`, `portal-sidebar.tsx`; retire/replace `src/components/portal-nav.tsx`.
- Add maroon top bar (avatar/name/sign-out/msg badge), white brand bar (logo + Playfair title), fixed 280px **grouped** sidebar mirroring static labels/groups + gold active state. Keep `ChatWidget`.
- Tokens: in `tailwind.config.ts`/`globals.css` optionally add Playfair display font + align gold to `#C5A55A`.

**WP-2 — Member home dashboard rebuild**
- Files: `src/app/(portal)/account/page.tsx`; new `src/components/portal/kpi-cards.tsx`, `recent-activity.tsx`, `quick-tiles.tsx`.
- Welcome banner → 4 KPI cards (Active Certs / CEUs x/40 / Next Renewal / IC&RC Status — data already loaded) → reminder note → quick-action tiles → recent-activity timeline (query last 5 across ceu_records/applications/payments, dotted timeline).

**WP-3 — Member surface polish (independent of WP-2)**
- `account/certifications/page.tsx`: add green "Active / good standing" banner + ensure wallet-card download action.
- `account/ceus/page.tsx`: ensure 4-stat + progress-bar layout and "Log CEU Hours" modal match static.
- `account/settings/page.tsx`: add Notification Preferences (4 toggles) + Danger-Zone deactivation block; confirm Change-Password modal.
- `account/requests/page.tsx`: add "Order IC&RC International Certificate" CTA card.
- `account/experience/page.tsx`: optional Employment "Status" column.

**WP-4 — Shared portal UI primitives**
- New `src/components/portal/badge.tsx` (status pills: active/pending/expired/info/gray w/ dot), `note-box.tsx` (info/warning/success), `card.tsx` (header band + maroon shadow). Used by WP-2/WP-3 and admin.

**WP-5 — Admin shell to left sidebar + counts**
- Files: `src/app/(admin)/admin/layout.tsx`, `src/components/admin/admin-nav.tsx`.
- Convert horizontal tabs → maroon full-height left sidebar; surface pending counts (already computed in `admin/page.tsx`) as gold count badges per nav item. Keep the extra Next.js-only admin routes in the sidebar.

**Suggested order:** WP-1 + WP-4 first (foundation) → then WP-2, WP-3, WP-5 in parallel.

---

## 5. Next.js features the static portal LACKS (do NOT regress)

These are net-new in the Next.js app and must be preserved:

- **AI assistant / navigator** — `ChatWidget` (member + admin surfaces), `src/components/assistant/*`, `/api` chat routes.
- **Public verification** — `src/app/(site)/verify/page.tsx` + `src/app/api/verification/route.ts` (anyone can verify a credential).
- **Stripe checkout / store** — `src/app/(site)/store`, `/checkout`, `/api/stripe/*`, payment status tracking.
- **Schedule engine** — `cert_schedules` + `src/lib/schedules.ts` + `src/lib/ceu-compliance.ts` (grace-aware renewals, per-credential CEU rules) and `admin/schedules`.
- **Two-way clinical supervision** — supervisor AND supervisee views (`account/experience`).
- **Reciprocity payment tracking** — direction (into/out of AZ) + $150 fee status.
- **Document requests** — admin can request documents; member sees open-request action items.
- **Expanded admin** — Reports, Finance, Compliance, Announcements, Audit Log, Member detail (`members/[id]`), Search.
- **Account-approval workflow**, **profile completeness**, **action-items** panel on home.

These should be folded into the new sidebar/dashboard IA, not removed.
