# CLAUDE.md — BSR Menopause Check

Handoff document for Claude Code. Read this first before touching any file.

---

## 1. What this is

**Product:** Self-service web tool that helps women in perimenopause/menopause
transition decide how urgently they need to see a doctor at Bangkok Hospital
Surat (BSR). Not a diagnostic tool, not a hormone-therapy decision aid — a
**service-need triage** front-door.

**Live URL:** https://menopause-check.pages.dev/
**Repo:** https://github.com/Bangkok-Hospital-Surat/menopause-check
**Deployment:** Cloudflare Pages, auto-deploys on push to `main`
**Owner:** Chin, BSR hospital director (product lead + clinical review coordinator)
**Users:** Thai women 40-65+, primarily. Physicians receive the printed PDF report
when patient brings it to consult.

**Format:** Single-file HTML (`index.html` at repo root). All CSS, JS, and the
BSR logo (base64 data URI) are inlined. No build step. No external hosting
dependencies beyond Google Fonts + one CDN (html2pdf.js from cdnjs).

---

## 2. Non-negotiables — the constitution

These are physician-approved principles. Do not weaken them without an
explicit sign-off comment in the commit message.

1. **Not diagnostic.** Every result page, every PDF, every disclaimer must say
   this. Screening tool → routes to a service pathway. Never diagnoses
   menopause, never diagnoses any condition.
2. **Cannot conclude HRT eligibility.** NAMS 2022 requires shared
   decision-making with clinician after full history/contraindication review.
   No calculator output ever implies "you can/cannot take HRT."
3. **Red flags are a stop rule, not a score input.** R01-R07 are Yes/No
   questions that force RED level immediately. They must not be additive with
   symptom score. Do not move R0X checkboxes into the symptom section.
4. **Zero data storage.** The hospital does NOT collect any data from the
   assessment. All computation is client-side. `postAggregateStats()` is
   hard-disabled with `return;` on the first line. The privacy disclaimer
   appears in 3 places: header, above submit button, PDF footer. Any change
   here requires updating all three AND the version tag.
5. **Thai-first everywhere.** UI labels, page title, badges, PDF headers —
   Thai leads, English follows in smaller/secondary treatment.
6. **1669 / 1323 always visible when relevant.** For R05 (cardiac/stroke
   symptoms) and R06 (suicidal ideation), the RED result page must show
   emergency number prominently.
7. **Score 0-40 is operational hypothesis.** The 10/20 cut-offs are pilot
   thresholds, not validated. Every mention of the score must include this
   caveat.

---

## 3. Deployment flow

```
Local edit → git commit → git push origin main
                            ↓
                    GitHub webhook fires
                            ↓
                Cloudflare Pages builds (~30s)
                            ↓
        LIVE at https://menopause-check.pages.dev/
```

**No build command, no framework, no output directory** — Cloudflare Pages
serves `index.html` directly from repo root. If setup ever needs to be
re-created in Cloudflare dashboard:

- Framework preset: **None**
- Build command: (empty)
- Build output directory: (empty)
- Production branch: `main`

**GitHub Pages is disabled** (Settings → Pages → Source: None). Do not
re-enable — it will create duplicate stale URLs.

---

## 4. File anatomy

Single file `index.html` (~175KB, ~1400 lines — includes two inlined base64
images: `BSR_LOGO_URI` and `BSR_FOOTER_BANNER_URI`). Sections in order:

| Line range (approx) | Section | Purpose |
|---|---|---|
| 1-260 | `<style>` main app CSS | Form styling, brand colors, print rules |
| 261-360 | `<style>` `.op-*` classes | One-page compact PDF report CSS |
| 265-370 | `<header>` | Logo + badge + H1 + sub + guideline cite + privacy block + disclaimer |
| 380-505 | `<form>` Sections 1-5 | Basic info, red flags, symptoms, life impact, risk modules |
| 506-518 | privacy-reassure block + submit btn | Trust badge above button |
| 560-561 | `#result` + `#onePageReport` | Two result containers |
| 570-580 | CONFIG object | Hospital contact info, GAS_URL placeholder |
| 585-600 | THRESHOLDS | Clinical cut-offs with source annotations |
| 605-620 | SYMPTOMS array | 10 symptom items with category tags |
| 623-635 | RED_FLAGS + RED_FLAG_PATHWAYS maps | R01-R07 definitions |
| 640-660 | LABELS map | Value → human-readable Thai for all form fields |
| 665-670 | GUIDELINE_VERSION + LAST_REVIEW_DATE | Update these on any semantic change |
| 705-715 | `postAggregateStats` | **HARD-DISABLED** — do not remove the `return;` line |
| 720-740 | `printReport` | Handles print for mobile + desktop-in-iframe |
| 755-810 | `sharePDF` | html2pdf.js flow — targets `#onePageReport` |
| 815-840 | `buildSymptomInputs` + `attachRedFlagWatcher` | Dynamic UI setup |
| 845-990 | `assess()` | Main triage logic (per BSR design doc §6) |
| 1000-1215 | `render()` | Populates `#result` (verbose screen output) |
| 1220-1415 | `buildOnePageReport()` | Populates `#onePageReport` (compact PDF) |
| 1420-1425 | DOMContentLoaded | Attaches logo + builds symptom UI |

---

## 5. Version history

Every change bumps the version in GUIDELINE_VERSION string. Print/PDF footer
displays it so physicians can identify which version produced a report.

| Ver | Date | Change | Reason |
|---|---|---|---|
| v1.0 | 2026-08-06 | Initial build from clinical design doc | Baseline |
| v1.1 | 2026-08-31 | Split "ประวัติผ่าตัด" into uterus + ovary questions; screening section changed from "ที่ควรทำ" → "ที่เคยตรวจมาก่อน" with logic flip | Physician feedback round 1 — simplify surgery, make screening informational-only |
| v1.2 | 2026-09-16 | Strengthened data-storage disclaimer (3 places) + hard-disabled `postAggregateStats` | Patient trust — physician request |
| v1.3 | 2026-09-16 | One-page compact PDF layout (2-column body, navy footer banner) | Reduce 4-page PDF to 1 page |
| v1.3.1 | 2026-09-16 | Header made Thai-first (badge bilingual, sub Thai-first, browser title Thai-first) | Physician noted "menopause" too prominent |
| v1.4 | 2026-09-16 | PDF report redesigned as clinical handoff doc (symptom summary grouped by category, 4-quadrant self-care) | Physician wanted "ข้อมูลสรุปปัญหา หรืออาการ" for consult |
| v1.4.1 | 2026-09-16 | Added `data-testid` hooks (op-banner / op-score / op-symcat / op-symcat-icon) to `buildOnePageReport()`; added Playwright QA harness under `tests/` | Non-clinical — stable automated QA. No logic, threshold, disclaimer, or red-flag change |
| v1.4.2 | 2026-09-16 | `sharePDF()` now renders the report to a canvas and places it as ONE A4 page scaled-to-fit (contain), instead of html2pdf auto-pagination | Bugfix — tall reports (red flags + many risk-factor chips) were spilling onto a 2nd page. No clinical/logic change |
| v1.4.3 | 2026-09-16 | `printReport()` (native "🖨️ พิมพ์/บันทึกเป็น PDF") now computes a print zoom (`computePrintScale`/`applyPrintFit`) so `window.print` also yields ONE A4 page — matters on iOS where users Save-as-PDF from the print sheet | Bugfix — the native-print path still overflowed to page 2 after v1.4.2 (which only fixed the html2pdf "แชร์ PDF" path). No clinical/logic change |
| v1.4.4 | 2026-09-16 | Header title condensed to a single Thai line (`แบบประเมินความจำเป็นในการพบแพทย์สำหรับผู้หญิงในช่วงเปลี่ยนผ่านวัยทอง`, English kept as secondary sub); removed the "quote this report number to staff" instruction from BOTH the PDF footer (`เลขที่รายงาน … แจ้งเลขนี้เมื่อติดต่อ`) and the on-screen red/orange contact card (`… โปรดแจ้งเลขนี้กับเจ้าหน้าที่เพื่อความรวดเร็ว`) | Physician — title was redundant; hospital stores no assessment data so a "quote this number" instruction is misleading. Neutral document-serial displays elsewhere kept. Wording only, no clinical/logic change |
| v1.5.0 | 2026-09-16 | Report (`#onePageReport`) re-laid out in HeartCheck Wise style: every section framed in an `.op-card`, header gains a divider rule (`.op-hr`), footer split into a navy contact banner (`.op-fbanner`) + a white citation strip (`.op-fnote`). `.op-report` is now a flex column with `min-height` ≈ A4 plus an `.op-body{flex:1}` spacer, so the **footer is pinned to the page bottom** even when the report is sparse | Physician — match the HeartCheck Wise report look; keep the footer anchored at the bottom instead of floating up under short content. Layout only, no clinical/logic change |
| v1.5.1 | 2026-09-16 | Footer now renders the shared **BSR banner image** (`BSR_FOOTER_BANNER_URI`, base64 of heartcheck-wise `assets/bsr-footer-banner.jpg` — navy shape + BANGKOK HOSPITAL SURAT logo + ☎1719 + QR) full-width via `.op-fbanner-img`, with the disclaimer + citation as a gray strip beneath. Report-footer phone is **1719 only**. `computePrintScale` now measures the inner `.op-report` at real print width (198mm) with a 283mm safety target so the taller banner still fits one page | Physician — footer must be identical to the HeartCheck Wise report. Asset/layout only, no clinical/logic change. (On-screen `#result` contact still uses CONFIG.PHONE 077-956-789 — unchanged) |

---

## 6. Coding conventions

### Brand colors (already in CSS `:root` vars)
- Navy `#0a2878` — headings, borders
- Brand red `#b01828` — accents, warnings
- Teal `#2a4ea0` / `#2f8f6b` — links, success
- Ink `#1a2542` — body text
- Muted `#5d6a85` — secondary text
- Line `#dde3ed` — borders
- Backgrounds — subtle `#fbfcfe` for cards

### Naming
- Form IDs: `age`, `lmp`, `cycle`, `surgery`, `ovary`, `impact`, plus chip
  sections `#hist`, `#redflags`, `#goals`, `#bone`, `#cardio`, `#hrtsafety`,
  `#screening`
- Symptom IDs: `S01`–`S10`, red-flag IDs: `R01`–`R07`
- CSS classes for the compact report use `.op-*` prefix
- Level values: `red` / `orange` / `yellow` / `green` (semantic, not by BSR class colors)

### Threshold convention
All cut-offs in the `THRESHOLDS` object at the top of the script. Each has
a source comment (NICE / ACOG / NAMS / USPSTF / pilot). Do not inline
magic numbers in `assess()` — put them in THRESHOLDS.

### Adding a new field
1. Add to form section in HTML
2. Add to `LABELS` map for pretty rendering
3. Collect in `assess()` input block
4. Update `patient` object passed to `render()`
5. Show in `render()` patient-summary card AND `buildOnePageReport()`
   context strip / risk-factor summary
6. Bump version + note in commit message

### Adding a new red flag (R08+)
1. Add to `RED_FLAGS` map (short label) and `RED_FLAG_PATHWAYS` map (routing)
2. Add checkbox to `#redflags` chips (must include `id="R08"` and `value="R08"`)
3. `attachRedFlagWatcher` will pick it up automatically
4. No changes to `assess()` needed — the `checked('#redflags')` collection covers it
5. **Physician sign-off required** before merging any red-flag change

---

## 7. Testing checklist (before every push)

Minimum:
1. Open `index.html` locally in browser (double-click or `python3 -m http.server`)
2. Verify no JS console errors on load
3. Fill 4 scenarios and check level output:
   - **RED**: tick R01 → should show ⛔ + Gynecology urgent + 1669 language
   - **ORANGE (POI)**: age 38, LMP 12m+, cycle stopped → orange + "อายุ <40 POI"
   - **ORANGE (surgical menopause)**: age 48, ovary=oopho_both → orange + "Induced menopause"
   - **GREEN**: age 52, all symptoms 0, no red flags → green + self-care
4. Click "🖨️ พิมพ์" → verify PDF is **1 page** with:
   - Header with logo + title + date
   - Big level number
   - Symptom summary grouped by category (if any symptoms >0)
   - Navy footer banner with contact + privacy + citation
5. Check version footer says the version you just bumped to

Ideal (if changing engine):
- Node syntax check: `node --check` on extracted `<script>` block
- Adversarial test: even with hardcoded fake `GAS_URL`, `fetch()` must not fire
  (postAggregateStats guarantee)

### Automated QA harness (`tests/report.test.js`)
A Playwright script drives the live (or local) site through **all 5 triage
scenarios**, plus the real PDF-generation flow and a mobile responsive check.
Run it before a push when you touched `assess()`, `buildOnePageReport()`, the
form, or the PDF/print path:

```bash
npm install          # first time only — installs playwright (devDependency)
npx playwright install chromium   # first time only — browser binary
npm test             # runs tests/report.test.js against the live site
npm run test:local   # same, but against a local file:// copy of index.html
```

**Coverage (48 assertions):**
| Block | What it verifies |
|---|---|
| RED (R01) | level=red, ⛔ "ภายใน 24 ชม.", R01 reason, 1669 note, `#result` "Gynecology urgent" pathway |
| GREEN | level=green, "6-8 สัปดาห์", no symptom rows, self-care advice |
| ORANGE-POI | age 38 + LMP 12m+/stopped → POI reason "อายุ <40", Gynecology module |
| ORANGE-surgical | age 48 + bilateral oophorectomy → "Induced menopause", ovary in context |
| ORANGE-general | score 30/40, 8 symptom categories + emojis, 2-col, 4 self-care, goals in talk |
| PDF flow ("แชร์ PDF") | clicks "แชร์ PDF", captures the real html2pdf.js download, asserts valid `%PDF`, >20KB, **single page** (`/Count 1`), filename `BSR-Menopause-Report-*.pdf`. Runs a **normal** and a **heavy** case (all symptoms maxed + every risk-factor chip + all goals) — both must be 1 page (v1.4.2 scale-to-fit) |
| Print flow ("🖨️ พิมพ์") | emulates print media, uses `page.pdf()` (Chromium print engine), asserts the app's `computePrintScale`+`applyPrintFit` fit both normal and heavy to **1 page** (heavy: raw 2 → fit 1 via zoom ≈0.95). This is the path iOS users hit when they Save-as-PDF from the print sheet (v1.4.3) |
| Mobile (375×812) | mobile UA, `#result` renders, **no horizontal overflow**, `#onePageReport` hidden on screen |

- Output artifacts (gitignored, reproducible): `tests/report-{red,green,poi,surgical,orange,mobile}.png`, `tests/report-orange.pdf`
- Full checklist with the **real** selectors: `tests/QA-checklist.md`
- The report exposes stable `data-testid` hooks so tests don't break on CSS
  refactors: `op-banner` (urgency banner + `data-level`), `op-score` (X/40),
  `op-symcat` (one per category, carries `data-cat`), `op-symcat-icon` (emoji).
- Form radios/checkboxes AND red-flag chips are hidden behind segmented-control
  / chip labels, so the harness sets their state via JS + dispatches `change`
  (see `setFormState` helper) rather than clicking the invisible inputs.
- Scenarios are data-driven at the top of the file — add a case by pushing to
  the `SCENARIOS` array with its `inputs` + `checks`.

---

## 8. Common tasks & how to do them

### Change a threshold
Edit `THRESHOLDS.<name>` — that's it. Do NOT inline the number in `assess()`.
Add a source comment if new (e.g., `// NICE NG23 2026 update`).
Bump patch version.

### Add a physician-suggested label change
Update the string in the form HTML AND in `LABELS.<field>` map if applicable.
For section headers, update both the form section AND any references in
`buildOnePageReport()`. Keep Thai-first ordering.

### Deploy an emergency fix
```bash
git add index.html
git commit -m "hotfix: <what and why>"
git push origin main
```
Cloudflare deploys in ~30s. Verify at `menopause-check.pages.dev` with
Ctrl+Shift+R.

### Roll back
```bash
git log --oneline    # find the good commit
git revert <bad-commit-sha>
git push origin main
```

---

## 9. DO NOT — hard prohibitions

1. **DO NOT re-enable `postAggregateStats`** without also updating all 3 privacy
   disclaimers (header, above-submit reassure, PDF footer) to match. The
   function's leading `return;` is the trust guarantee.
2. **DO NOT store patient data** in localStorage / sessionStorage / cookies /
   IndexedDB / any web storage. All in-memory only.
3. **DO NOT add server-side endpoints** or backend calls to the hospital
   system. This is a client-only tool by design.
4. **DO NOT infer diagnosis** in result text. Always frame as urgency +
   pathway, not "you have X." Avoid stigmatizing language like "high risk
   of cancer."
5. **DO NOT recommend HRT** or state anyone "should/should not use hormones."
   NAMS 2022 explicitly requires shared decision-making after clinician review.
6. **DO NOT change RED flag content** without physician sign-off documented
   in commit message. R01-R07 were reviewed against ACOG 2026, NICE NG23,
   NAMS statements.
7. **DO NOT split the file** into multiple HTML/CSS/JS without careful
   review. Single-file is a deployment simplicity choice — patients can even
   save the file offline.
8. **DO NOT change deployment target** to anywhere else (GitHub Pages,
   Vercel, Netlify) without updating the QR codes that patients are given.
   Current QR points to `menopause-check.pages.dev`.

---

## 10. Related tools in the org

Same pattern (single-file HTML + Cloudflare Pages):

- `Bangkok-Hospital-Surat/stroke-screening` — Stroke risk (originally on
  BSR1719 personal account, may need transfer)
- `Bangkok-Hospital-Surat/ThaiCVRiskScore` — Thai CV risk (multi-file
  structure with `css/`, `src/` directories — different pattern)
- `Bangkok-Hospital-Surat/heartcheck-wise` — CV screening (similar to
  ThaiCVRiskScore, multi-file)

If asked to apply a change across all tools, ask which pattern applies —
menopause-check is single-file, others are multi-file.

---

## 11. Reference materials

### Clinical guidelines
- NICE NG23 Menopause: identification and management (updated April 2026)
  https://www.nice.org.uk/guidance/ng23
- ACOG Updated Guidance on Evaluation of Postmenopausal Bleeding (April 2026)
- NAMS 2022 Hormone Therapy Position Statement
- NAMS 2023 Nonhormone Therapy Position Statement
- USPSTF Osteoporosis Screening (January 2025)
- WHO Menopause Fact Sheet (October 2024)

### Design source doc
`BSR_Menopause_Check_Questionnaire_Architecture.pdf` v1.0 (6 Aug 2026) — the
13-page clinical/operational spec that everything is built from. If a design
question is unclear, this is the source of truth.

### Physician feedback log
Feedback comes verbally through Chin. Preserve context in commit messages:
`v1.X: <change> — <physician name if given, else "physician round N">`.
The version history table above is the running log.

---

## 12. Contact

- Product lead: Chin (hospital director) — decisions on scope, priority
- Clinical review: (assigned physician) — sign-off on red flags, HRT
  disclaimer, symptom wording
- Deployment: automated via Cloudflare Pages — no separate ops contact

For anything urgent that could affect patient safety (wrong red-flag routing,
disclaimer removed, HRT recommendation appearing) — HALT the change, ask Chin
before proceeding.

---

_Last updated: 2026-09-16, at v1.5.1_
