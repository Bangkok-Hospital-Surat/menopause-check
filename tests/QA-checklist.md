# QA Checklist — `#onePageReport` (v1.4.1)

Manual + automated verification for the one-page clinical handoff report.
Selectors below are the **real** DOM produced by `buildOnePageReport()` in
`index.html` — verified against the rendered page, not guessed.

The automated harness (`tests/orange-v1.4.test.js`) asserts all of these.
Run it with `npm test` (live site) or `npm run test:local` (local file).

---

## Scenario: ORANGE

| Field | Value | Selector / how to set |
|---|---|---|
| อายุ | `52` | `#age` |
| ประจำเดือนครั้งสุดท้าย | `4-11m` | `#lmp` |
| รอบเดือน 12 เดือน | `irregular` | `#cycle` |
| ประวัติผ่าตัดมดลูก | `none` | `#surgery` |
| อาการ S01–S10 | ทุกข้อ = `3` | radio `#S01_3` … `#S10_3` |
| ผลกระทบต่อชีวิต | `2` | radio `#imp2` |
| เป้าหมาย | `vasomotor`, `sleep_mood` | `#goals input[value="…"]` |
| submit | — | `button` ที่มี `onclick="assess()"` / text "ประเมินความจำเป็น →" |

Expected: level **orange**, score **30/40**, banner "ภายใน 7-14 วัน".

> ⚠️ Form radios/checkboxes are **hidden inputs** behind segmented-control /
> chip `<label>`s that intercept pointer events. `page.check()` does NOT work.
> Set `.checked = true` via JS and dispatch `change` (see `setFormState`
> helper in the test). `assess()` reads DOM state at submit time.

---

## Checklist — verify inside `#onePageReport`

| # | Item | Real selector | Assertion |
|---|---|---|---|
| 1 | Header | `.op-header` | contains an `<img>` and text `ผลการประเมิน` (title is `<p class="op-htitle-main">`, **not** `<h1>`) |
| 2 | Urgency banner (orange) | `[data-testid="op-banner"]` (a.k.a. `.op-lvl-big.orange`) | text contains `7-14 วัน`; `data-level="orange"` |
| 3 | Score | `[data-testid="op-score"]` (a.k.a. `.op-score-big`) | text (whitespace-stripped) contains `30/40` |
| 4 | Symptom categories | `[data-testid="op-symcat"]` (a.k.a. `.op-symcat`) | exactly **8** elements; each carries `data-cat` in {vasomotor, sleep, cardiac, mood, cognitive, musculoskeletal, gsm, urinary} |
| 5 | Category emojis | `[data-testid="op-symcat-icon"]` | 8 icons = 🔥 😴 💓 😔 🧠 💪 🌸 🚽; none empty / `▯` / `�` |
| 6 | Context strip | `.op-context` | contains `อายุ 52` |
| 7 | Two-column block | `.op-two` | contains exactly 2 `.op-col` (reasons + service pathway) |
| 8 | Self-care | `.op-care-item` | exactly **4** items |
| 9 | Talk-with-doctor | `.op-talk` | contains `ร้อนวูบวาบ` (from `vasomotor` goal) |
| 10 | Footer banner | `.op-footer` | contains phone `077-956-789` |

---

## Notes / gotchas discovered during testing

- **`.op-banner.orange` does NOT exist.** There is no `op-banner` *class*; the
  banner is `.op-lvl-big.orange`. Prefer the stable `[data-testid="op-banner"]`
  hook (added v1.4.1).
- The report title is a `<p class="op-htitle-main">`, not an `<h1>` — assert on
  text, not tag.
- `#onePageReport` is normally hidden (shown only during print/PDF). To
  screenshot it, temporarily force `display:block; position:static; opacity:1`.
- Expected score math: 10 symptoms × 3 = **30**; threshold ≥20 → contributes to
  ORANGE. Score is an operational hypothesis (not validated) per the constitution.

---

_Last updated: 2026-09-16, v1.4.1 — selectors verified against live render._
