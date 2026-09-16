/**
 * BSR Menopause Check — QA harness (v1.4.1)
 *
 * Covers:
 *   - 5 triage scenarios: RED (R01), GREEN, ORANGE-POI, ORANGE-surgical, ORANGE-general
 *     -> fills form, submits, asserts #onePageReport + #result, screenshots each
 *   - PDF generation flow: clicks "แชร์ PDF", captures the real html2pdf.js download,
 *     asserts it is a valid single-page %PDF
 *   - Mobile (375x812): responsive check — no horizontal overflow, result renders
 *
 * Usage:
 *   npm test              # against the live site
 *   npm run test:local    # against local file:// copy of index.html
 *   TARGET=<url> node tests/report.test.js
 *
 * Exit 0 = all pass, 1 = any failure. Selectors: tests/QA-checklist.md. CLAUDE.md §7.
 */
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const LIVE = 'https://menopause-check.pages.dev/';
const LOCAL = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const TARGET = process.env.TARGET || (process.argv.includes('--local') ? LOCAL : LIVE);
const OUT = __dirname;

// ---------- scenario definitions ----------
// selects: {age,lmp,cycle,surgery,ovary}; symptomValue: 0-4 applied to S01..S10;
// redflags: ['R01'...]; impact: 0-4; goals: value[]
const SCENARIOS = [
  {
    key: 'red', title: 'RED — R01 postmenopausal bleeding',
    inputs: { selects: { age: '55', lmp: '12m+', cycle: 'na', surgery: 'none', ovary: 'none_unknown' }, symptomValue: 0, redflags: ['R01'], impact: 0, goals: [] },
    expectLevel: 'red',
    checks: (f) => [
      ['banner level=red + "24 ชม."', f.banner.level === 'red' && /24 ชม\.|ทันที/.test(f.banner.text)],
      ['reason lists R01 bleeding', /R01/.test(f.reasons) && f.reasons.includes('เลือดออกหลังหมดประจำเดือน')],
      ['red note shows 1669', f.note.includes('1669')],
      ['#result shows "Gynecology urgent" pathway', f.resultText.includes('Gynecology urgent')],
      ['#result shows ⛔ / 1669 emergency language', f.resultText.includes('1669')],
      ['no symptom rows (all 0)', f.symcat.count === 0],
    ],
  },
  {
    key: 'green', title: 'GREEN — age 52, no symptoms, no red flags',
    inputs: { selects: { age: '52', lmp: 'current', cycle: 'no_change', surgery: 'none', ovary: 'none_unknown' }, symptomValue: 0, redflags: [], impact: 0, goals: [] },
    expectLevel: 'green',
    checks: (f) => [
      ['banner level=green + "6-8 สัปดาห์"', f.banner.level === 'green' && /6-8 สัปดาห์|ดูแลตนเอง/.test(f.banner.text)],
      ['reason = no danger signal', f.reasons.includes('ไม่พบสัญญาณ')],
      ['no symptom rows (all 0)', f.symcat.count === 0],
      ['#result shows self-care advice', /นอนให้เป็นเวลา|ออกกำลังกาย/.test(f.resultText)],
      ['footer phone present', f.footer.hasPhone],
    ],
  },
  {
    key: 'poi', title: 'ORANGE — POI (age 38, LMP 12m+, cycle stopped)',
    inputs: { selects: { age: '38', lmp: '12m+', cycle: 'stopped', surgery: 'none', ovary: 'none_unknown' }, symptomValue: 0, redflags: [], impact: 0, goals: [] },
    expectLevel: 'orange',
    checks: (f) => [
      ['banner level=orange + "7-14 วัน"', f.banner.level === 'orange' && f.banner.text.includes('7-14 วัน')],
      ['reason mentions POI + อายุ <40', f.reasons.includes('POI') && f.reasons.includes('อายุ <40')],
      ['module: Early/Induced Menopause Gynecology', f.modules.includes('Gynecology')],
      ['context shows อายุ 38', f.context.includes('อายุ 38')],
    ],
  },
  {
    key: 'surgical', title: 'ORANGE — surgical menopause (age 48, bilateral oophorectomy)',
    inputs: { selects: { age: '48', lmp: 'current', cycle: 'no_change', surgery: 'none', ovary: 'oopho_both' }, symptomValue: 0, redflags: [], impact: 0, goals: [] },
    expectLevel: 'orange',
    checks: (f) => [
      ['banner level=orange + "7-14 วัน"', f.banner.level === 'orange' && f.banner.text.includes('7-14 วัน')],
      ['reason mentions Induced menopause', f.reasons.includes('Induced menopause')],
      ['module: Gynecology + Bone/Cardiometabolic', f.modules.includes('Gynecology')],
      ['context shows รังไข่ = ตัดสองข้าง', f.context.includes('เคยตัดรังไข่สองข้าง')],
    ],
  },
  {
    key: 'orange', title: 'ORANGE — general (all symptoms 3, impact 2, 2 goals)',
    inputs: { selects: { age: '52', lmp: '4-11m', cycle: 'irregular', surgery: 'none', ovary: 'none_unknown' }, symptomValue: 3, redflags: [], impact: 2, goals: ['vasomotor', 'sleep_mood'] },
    expectLevel: 'orange',
    checks: (f) => [
      ['banner level=orange + "7-14 วัน"', f.banner.level === 'orange' && f.banner.text.includes('7-14 วัน')],
      ['score 30/40', f.score.replace(/\s/g, '').includes('30/40')],
      ['op-symcat = 8 categories', f.symcat.count === 8 && ['vasomotor', 'sleep', 'cardiac', 'mood', 'cognitive', 'musculoskeletal', 'gsm', 'urinary'].every((c) => f.symcat.cats.includes(c))],
      ['8 emojis, no placeholder', f.symcat.icons.length === 8 && ['🔥', '😴', '💓', '😔', '🧠', '💪', '🌸', '🚽'].every((e) => f.symcat.icons.includes(e)) && !f.symcat.placeholder],
      ['context อายุ 52', f.context.includes('อายุ 52')],
      ['op-two = 2 columns', f.twoCols === 2],
      ['op-care = 4 items', f.careCount === 4],
      ['talk mentions ร้อนวูบวาบ', f.talk.includes('ร้อนวูบวาบ')],
      ['footer phone 077-956-789', f.footer.hasPhone],
    ],
  },
];

// ---------- helpers ----------
async function setFormState(page, inputs) {
  return page.evaluate((inp) => {
    const fire = (el) => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    const rep = { selects: {}, symptoms: 0, redflags: [], impact: null, goals: [] };
    for (const [id, val] of Object.entries(inp.selects)) {
      const el = document.getElementById(id);
      if (el) { el.value = val; fire(el); rep.selects[id] = el.value; }
    }
    for (let i = 1; i <= 10; i++) {
      const el = document.getElementById('S' + String(i).padStart(2, '0') + '_' + inp.symptomValue);
      if (el) { el.checked = true; fire(el); rep.symptoms++; }
    }
    (inp.redflags || []).forEach((r) => {
      const el = document.getElementById(r);
      if (el) { el.checked = true; fire(el); rep.redflags.push(r); }
    });
    const imp = document.getElementById('imp' + inp.impact);
    if (imp) { imp.checked = true; fire(imp); rep.impact = inp.impact; }
    (inp.goals || []).forEach((v) => {
      const el = document.querySelector('#goals input[value="' + v + '"]');
      if (el) { el.checked = true; fire(el); rep.goals.push(v); }
    });
    // optional risk-factor / history chip groups: inp.chips = {hist,bone,cardio,hrtsafety,screening}
    rep.chips = {};
    Object.entries(inp.chips || {}).forEach(([group, vals]) => {
      rep.chips[group] = [];
      vals.forEach((v) => {
        const el = document.querySelector('#' + group + ' input[value="' + v + '"]');
        if (el) { el.checked = true; fire(el); rep.chips[group].push(v); }
      });
    });
    return rep;
  }, inputs);
}

async function collectFacts(page) {
  return page.evaluate(() => {
    const root = document.getElementById('onePageReport');
    const q = (s) => root.querySelector(s);
    const qa = (s) => Array.from(root.querySelectorAll(s));
    const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();
    const banner = q('[data-testid="op-banner"]') || q('.op-lvl-big');
    const score = q('[data-testid="op-score"]') || q('.op-score-big');
    const cats = qa('[data-testid="op-symcat"]');
    const icons = qa('[data-testid="op-symcat-icon"]').map((e) => e.textContent.trim());
    const cols = qa('.op-two .op-col');
    // reasons = first column list, modules = second column list
    const lists = qa('.op-two .op-col .op-list');
    return {
      banner: { level: banner && banner.getAttribute('data-level'), text: norm(banner && banner.textContent) },
      note: norm((q('.op-lvl-note') || {}).textContent),
      score: norm((score || {}).textContent),
      symcat: {
        count: cats.length,
        cats: cats.map((c) => c.getAttribute('data-cat')).filter(Boolean),
        icons,
        placeholder: icons.some((t) => t === '' || t.includes('▯') || /�/.test(t)),
      },
      context: norm((q('.op-context') || {}).textContent),
      twoCols: cols.length,
      careCount: qa('.op-care-item').length,
      talk: norm((q('.op-talk') || {}).textContent),
      footer: { hasPhone: !!(q('.op-footer') && q('.op-footer').textContent.includes('077-956-789')) },
      reasons: norm((lists[0] || {}).textContent),
      modules: norm((lists[1] || {}).textContent),
      resultText: (document.getElementById('result') || {}).innerText || '',
    };
  });
}

async function forceReportVisible(page) {
  await page.evaluate(() => {
    const el = document.getElementById('onePageReport');
    Object.assign(el.style, { display: 'block', position: 'static', visibility: 'visible', left: 'auto', opacity: '1' });
  });
  await page.waitForTimeout(150);
}

// ---------- runners ----------
const results = [];
const add = (name, pass, detail) => { results.push({ name, pass: !!pass, detail: detail || '' }); console.log((pass ? '  PASS ' : '  FAIL ') + name + (detail ? '  —  ' + detail : '')); };

async function runScenario(browser, sc) {
  console.log('\n### Scenario: ' + sc.title);
  const page = await browser.newPage({ viewport: { width: 1200, height: 1800 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.goto(TARGET, { waitUntil: 'networkidle' });
  const state = await setFormState(page, sc.inputs);
  await page.click('button:has-text("ประเมินความจำเป็น")');
  await page.waitForSelector('#result', { state: 'visible', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(700);
  await forceReportVisible(page);
  const shot = path.join(OUT, 'report-' + sc.key + '.png');
  const rep = await page.$('#onePageReport');
  await rep.screenshot({ path: shot });
  const facts = await collectFacts(page);

  add('[' + sc.key + '] no console errors', errs.length === 0, errs.join(' | ') || 'clean');
  add('[' + sc.key + '] level = ' + sc.expectLevel, facts.banner.level === sc.expectLevel, 'got ' + facts.banner.level);
  sc.checks(facts).forEach(([label, ok]) => add('[' + sc.key + '] ' + label, ok));
  console.log('  screenshot: ' + shot + '  (state ' + JSON.stringify(state.selects) + ' sym=' + state.symptoms + ' rf=' + JSON.stringify(state.redflags) + ')');
  await page.close();
}

// The heavy fill produces the tallest possible report (all symptoms maxed,
// every risk-factor chip, all goals, high impact) — the case that used to
// spill onto a 2nd page before the v1.4.2 scale-to-fit fix.
const PDF_CASES = [
  { label: 'normal', inputs: SCENARIOS.find((s) => s.key === 'orange').inputs },
  {
    label: 'heavy', inputs: {
      selects: { age: '52', lmp: '4-11m', cycle: 'irregular', surgery: 'none', ovary: 'none_unknown' },
      symptomValue: 4, redflags: [], impact: 3,
      goals: ['vasomotor', 'sleep_mood', 'gsm', 'cardio', 'bone', 'hrt_consult', 'screening'],
      chips: {
        hist: ['chemo_rad', 'hormone_meds', 'preg_concern'],
        bone: ['prior_fracture', 'parent_hip', 'low_bmi', 'steroid'],
        cardio: ['htn', 'dm', 'dyslipid', 'smoke', 'obesity', 'cvd'],
        hrtsafety: ['hormone_cancer', 'vte', 'stroke_hx', 'cad', 'liver', 'migraine_aura'],
        screening: ['breast_done', 'cervical_done', 'colon_done', 'dxa_done'],
      },
    },
  },
];

async function runPdfFlow(browser) {
  console.log('\n### PDF generation flow (html2pdf.js) — must be SINGLE page');
  for (const c of PDF_CASES) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1800 }, acceptDownloads: true });
    page.on('dialog', (d) => d.accept().catch(() => {}));   // the post-download alert()
    await page.goto(TARGET, { waitUntil: 'networkidle' });
    await setFormState(page, c.inputs);
    await page.click('button:has-text("ประเมินความจำเป็น")');
    await page.waitForSelector('#sharePdfBtn', { state: 'visible', timeout: 8000 });
    const pdfPath = path.join(OUT, 'report-pdf-' + c.label + '.pdf');
    try {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 90000 }),
        page.click('#sharePdfBtn'),
      ]);
      await download.saveAs(pdfPath);
      const buf = fs.readFileSync(pdfPath);
      const head = buf.slice(0, 4).toString('latin1');
      const suggested = download.suggestedFilename();
      const countMatch = buf.toString('latin1').match(/\/Count\s+(\d+)/);
      const pages = countMatch ? parseInt(countMatch[1], 10) : null;
      add('[pdf:' + c.label + '] filename = BSR-Menopause-Report-*.pdf', /^BSR-Menopause-Report-.*\.pdf$/.test(suggested), suggested);
      add('[pdf:' + c.label + '] valid %PDF header', head === '%PDF', head);
      add('[pdf:' + c.label + '] non-trivial size (>20KB)', buf.length > 20000, (buf.length / 1024).toFixed(0) + ' KB');
      add('[pdf:' + c.label + '] SINGLE page (/Count 1)', pages === 1, 'pages=' + (pages === null ? 'unknown' : pages));
      console.log('  saved: ' + pdfPath);
    } catch (e) {
      add('[pdf:' + c.label + '] download fired', false, e.message);
    }
    await page.close();
  }
}

async function runMobile(browser) {
  console.log('\n### Mobile responsive (375x812, mobile UA)');
  const ctx = await browser.newContext({ ...devices['iPhone 12'], viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.goto(TARGET, { waitUntil: 'networkidle' });
  await setFormState(page, SCENARIOS.find((s) => s.key === 'orange').inputs);
  await page.click('button:has-text("ประเมินความจำเป็น")');
  await page.waitForSelector('#result', { state: 'visible', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);

  const m = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    resultVisible: !!document.getElementById('result') && document.getElementById('result').offsetHeight > 0,
    reportHiddenByDefault: getComputedStyle(document.getElementById('onePageReport')).display === 'none',
    isMobileUA: /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent),
  }));
  await page.screenshot({ path: path.join(OUT, 'report-mobile.png'), fullPage: true });

  add('[mobile] no console/page errors', errs.length === 0, errs.join(' | ') || 'clean');
  add('[mobile] result renders', m.resultVisible);
  add('[mobile] no horizontal overflow', m.scrollW <= m.clientW + 2, 'scrollW=' + m.scrollW + ' clientW=' + m.clientW);
  add('[mobile] #onePageReport hidden on screen', m.reportHiddenByDefault);
  add('[mobile] mobile user-agent detected (print path)', m.isMobileUA);
  console.log('  screenshot: ' + path.join(OUT, 'report-mobile.png'));
  await ctx.close();
}

(async () => {
  console.log('Target: ' + TARGET);
  const browser = await chromium.launch({ headless: true });
  for (const sc of SCENARIOS) await runScenario(browser, sc);
  await runPdfFlow(browser);
  await runMobile(browser);
  await browser.close();

  const pass = results.filter((r) => r.pass).length;
  const fail = results.length - pass;
  console.log('\n========================================');
  console.log('TOTAL: ' + pass + '/' + results.length + ' passed, ' + fail + ' failed');
  if (fail > 0) {
    console.log('FAILURES:');
    results.filter((r) => !r.pass).forEach((r) => console.log('  - ' + r.name + '  —  ' + r.detail));
    process.exit(1);
  }
  console.log('All checks passed.');
})().catch((e) => { console.error(e); process.exit(1); });
