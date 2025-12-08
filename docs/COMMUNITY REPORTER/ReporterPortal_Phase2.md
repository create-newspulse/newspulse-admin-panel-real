# Reporter Portal – Phase 2

This chapter outlines the second phase of the Community program, covering the Reporter Portal workspace, Community Hub cards, the Community Reporter Queue, My Community Stories, and the Contact Directory with safety rules. Use this as the planning source of truth for UX, data flows, and governance.

## 1. Components Overview

### Community Hub
- Central landing page for all Community tools.
- Cards: Community Dashboard/Reporter Portal, Community Reporter Queue, My Community Stories.
- Purpose: help Founder/Admin and reporters quickly navigate to the right place.

### 🧑‍🤝‍🧑 Community Reporter Queue
- Founder/Admin/Editors moderation view showing pending, approved, rejected, and removed stories.
- Accessible from the top navigation and via Community Hub.
- Internal-only; exposes extra verification details (contact/location) and decisions.

### Reporter Portal
- Reporter’s own workspace (public-facing for reporters; founder preview exists in admin).
- Shows counters, recent stories, and quick actions (Open My Stories, Submit New Story).
- Phase 2 focuses on pagination, improved recent list, and clearer statuses.

### My Community Stories
- Personal list of stories submitted by the current reporter.
- Tied to Reporter Portal (Open My Stories) and to Queue decisions (status + reasoning).
- Provides context-aware actions (Edit/Submit/Withdraw/New Draft) based on status.

| Area                     | Who uses it                  | Main purpose                               |
|--------------------------|------------------------------|--------------------------------------------|
| Community Hub            | Founder / Admin              | Entry to all community-tools               |
| Community Reporter Queue | Founder / Editors            | Review, approve, reject community stories  |
| Reporter Portal          | Community Reporter (public)  | Submit & track their own stories           |

## 2. Contact Directory & Privacy Rules

Reporter contact details are stored in the backend database (not in the frontend). They are visible only to Founder/Admin/Editors through the Queue and related internal tools. They are never displayed on the public site or public story pages.

### 2.1 Fields we collect
- City/Town, District, State/Region, Country
- Name
- Email
- Phone / WhatsApp
- Preferred contact method
- Consent checkboxes (for follow-up and for future story alerts)

### 2.2 Who can see this data
- Founder, Admin, and assigned Editors.
- Not visible to other reporters or regular users.

### 2.3 Safety & retention
- Data used only for verification and future story collaboration.
- Access and decisions will be logged in Safe Owner Zone (Phase 2/3).
- Founder can delete or anonymise a reporter if required by policy, legal, or safety.

## 3. My Community Stories – Statuses & Actions

Statuses and meanings:
- `draft` – Reporter saved but not submitted.
- `under_review` – Submitted; awaiting editorial decision.
- `approved` – Accepted; may be scheduled or already published.
- `rejected` – Not accepted; internal notes retained for audit trail.
- `withdrawn` – Pulled back by reporter before decision.

Actions by status:

| Status        | Reporter actions                         | Admin/Editor actions                   |
|---------------|-------------------------------------------|----------------------------------------|
| draft         | Edit, Submit, Delete                      | —                                      |
| under_review  | View, (maybe) Withdraw if allowed         | Approve, Reject, Request changes       |
| approved      | View                                      | Publish, schedule, archive             |
| rejected      | View, Duplicate to new draft              | Add private notes                      |
| withdrawn     | View, Duplicate to new draft              | —                                      |

Note: Withdraw is only permitted while `under_review` and before approval/publish.

## 4. Reporter Portal UX – Phase 2

- Top counters: Total, Drafts, Pending, Approved, Rejected.
- Primary CTAs: “Open My Stories” (navigates to My Community Stories) and “Submit New Story”.
- Recent stories list:
  - Shows the latest 5–10 items for the current reporter.
  - When the reporter has hundreds of stories, show pagination or a “View all” link to My Community Stories.
- Founder/Admin preview (inside admin) may show all reporters’ stories; the public Reporter Portal shows only the logged-in reporter’s content.

## 5. Risk Scenarios & Protection

- Reporter sends abusive or fake content repeatedly.
  - Action: Flag in Contact Directory, limit submissions, or block.
- Contact details leak risk.
  - Action: restrict queue access; log viewing; add Safe Owner Zone controls for audits.
- Story already live, reporter requests removal.
  - Action: process via editorial workflow; keep internal record; update public article status (unpublish, remove, or annotate per policy).

Founder go-live checklist:
- [ ] Queue access restricted to Founder/Admin/Editors.
- [ ] Contact Directory visibility confirmed (no exposure in public UI).
- [ ] Withdraw and New Draft flows tested.
- [ ] Safe Owner Zone logging strategy documented.
- [ ] Removal/appeal policy confirmed with editorial/legal.

## 6. TODO / Implementation Notes

- Wire “My Community Stories” table to real API (page/limit; totals for pagination).
- Add withdraw button with rules (allowed only `under_review`).
- Add Contact Directory view for Founder/Admin (with filters by city/state and flags).
- Add Safe Owner Zone settings for retention, blocking, and audit logs.
- Improve recent list on Reporter Portal with pagination or “View all”.
- Integrate decision reason display for rejected items everywhere it’s relevant.
- (Future) Reporter profile management with preferred contact and notification settings.
- (Future) Automated risk scoring and rate limiting.
