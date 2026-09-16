/**
 * Automated QA — v1.4.1 ORANGE scenario for #onePageReport.
 *
 * Usage:
 *   npm test              # against the live site
 *   npm run test:local    # against local file:// copy of index.html
 *   TARGET=<url> node tests/orange-v1.4.test.js
 *
 * Exit code 0 = all checks pass, 1 = at least one failure (CI-friendly).
 * Selectors documented in tests/QA-checklist.md. See CLAUDE.md §7.
 */
const { chromium } = require('playwright');
const path = require('path');

const LIVE = 'https://menopause-check.pages.dev/';
const LOCAL = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
// Target precedence: TARGET env > --local flag > live site.
const TARGET = process.env.TARGET || (process.argv.includes('--local') ? LOCAL : LIVE);
const OUT_PNG = path.resolve(__dirname, 'orange-v1.4.png');

// ORANGE scenario definition
const SCENARIO = {
  selects: { age: '52', lmp: '4-11m', cycle: 'irregular', surgery: 'none' },
  symptomValue: 3,          // S01..S10 all = 3  -> score 30/40
  impact: 2,                // #imp2
  goals: ['vasomotor', 'sleep_mood'],
};

/**
 * Form radios/checkboxes are hidden behind segmented-control / chip labels
 * that swallow clicks. Set state directly + dispatch change (assess() reads
 * DOM state at submit; the red-flag watcher listens on `change`).
 */
async function setFormState(page, scenario) {
  return page.evaluate((sc) => {
    const report = { selects: {}, symptoms: [], impact: null, goals: [] };
    const fire = (el) => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    // selects
    for (const [id, val] of Object.entries(sc.selects)) {
      const el = document.getElementById(id);
      if (el) { el.value = val; fire(el); report.selects[id] = el.value; }
    }
    // symptoms S01..S10 = symptomValue
    for (let i = 1; i <= 10; i++) {
      const id = 'S' + String(i).padStart(2, '0') + '_' + sc.symptomValue;
      const el = document.getElementById(id);
      if (el) { el.checked = true; fire(el); report.symptoms.push(id); }
    }
    // impact
    const imp = document.getElementById('imp' + sc.impact);
    if (imp) { imp.checked = true; fire(imp); report.impact = 'imp' + sc.impact; }
    // goals
    sc.goals.forEach((v) => {
      const el = document.querySelector('#goals input[value="' + v + '"]');
      if (el) { el.checked = true; fire(el); report.goals.push(v); }
    });
    return report;
  }, scenario);
}

function assertChecks(root, verify) {
  // runs in browser context
}

(async () => {
  const results = [];
  const add = (name, pass, detail) => results.push({ name, pass: !!pass, detail });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1800 } });

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

  console.log('Target: ' + TARGET);
  await page.goto(TARGET, { waitUntil: 'networkidle' });

  const setState = await setFormState(page, SCENARIO);
  console.log('Set state: ' + JSON.stringify(setState));

  await page.click('button:has-text("ประเมินความจำเป็น")');
  await page.waitForSelector('#result', { state: 'visible', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const rep = await page.$('#onePageReport');
  if (!rep) {
    console.error('FATAL: #onePageReport not found');
    await browser.close();
    process.exit(1);
  }

  // force-visible for screenshot (normally shown only for print)
  await page.evaluate(() => {
    const el = document.getElementById('onePageReport');
    Object.assign(el.style, { display: 'block', position: 'static', visibility: 'visible', left: 'auto', opacity: '1' });
  });
  await page.waitForTimeout(250);

  const box = await rep.boundingBox();
  await rep.screenshot({ path: OUT_PNG });

  // Collect assertions from the DOM. Prefer data-testid, fall back to class.
  const checks = await page.evaluate(() => {
    const root = document.getElementById('onePageReport');
    const q = (s) => root.querySelector(s);
    const qa = (s) => Array.from(root.querySelectorAll(s));
    const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();

    const header = q('.op-header');
    const banner = q('[data-testid="op-banner"]') || q('.op-lvl-big.orange');
    const score = q('[data-testid="op-score"]') || q('.op-score-big');
    const cats = qa('[data-testid="op-symcat"]').length ? qa('[data-testid="op-symcat"]') : qa('.op-symcat');
    const icons = (qa('[data-testid="op-symcat-icon"]').length ? qa('[data-testid="op-symcat-icon"]') : qa('.op-symcat-icon')).map((e) => e.textContent.trim());
    const ctx = q('.op-context');
    const two = q('.op-two');
    const care = qa('.op-care-item');
    const talk = q('.op-talk');
    const footer = q('.op-footer');

    const EXPECT_CATS = ['vasomotor', 'sleep', 'cardiac', 'mood', 'cognitive', 'musculoskeletal', 'gsm', 'urinary'];
    const EXPECT_EMOJI = ['🔥', '😴', '💓', '😔', '🧠', '💪', '🌸', '🚽'];
    const catAttrs = cats.map((c) => c.getAttribute('data-cat')).filter(Boolean);

    return {
      header: { present: !!header, hasImg: !!(header && header.querySelector('img')), hasTitle: !!(header && header.textContent.includes('ผลการประเมิน')) },
      banner: { present: !!banner, text: norm(banner && banner.textContent), has: !!(banner && banner.textContent.includes('7-14 วัน')), level: banner && banner.getAttribute('data-level') },
      score: { present: !!score, text: norm(score && score.textContent), has: !!(score && score.textContent.replace(/\s+/g, '').includes('30/40')) },
      symcat: { count: cats.length, cats: catAttrs, allCats: EXPECT_CATS.every((c) => catAttrs.length ? catAttrs.includes(c) : true) },
      icons: { list: icons, count: icons.length, allPresent: EXPECT_EMOJI.every((e) => icons.includes(e)), hasPlaceholder: icons.some((t) => t === '' || t.includes('▯') || /�/.test(t)) },
      context: { present: !!ctx, has: !!(ctx && norm(ctx.textContent).includes('อายุ 52')) },
      two: { present: !!two, cols: two ? two.querySelectorAll('.op-col').length : 0 },
      care: { count: care.length },
      talk: { present: !!talk, has: !!(talk && talk.textContent.includes('ร้อนวูบวาบ')) },
      footer: { present: !!footer, has: !!(footer && footer.textContent.includes('077-956-789')) },
    };
  });

  add('no console errors', consoleErrors.length === 0, consoleErrors.join(' | ') || 'clean');
  add('op-header (img + ผลการประเมิน)', checks.header.present && checks.header.hasImg && checks.header.hasTitle, JSON.stringify(checks.header));
  add('op-banner "7-14 วัน" (level=orange)', checks.banner.has && checks.banner.level === 'orange', checks.banner.text + ' / level=' + checks.banner.level);
  add('op-score "30/40"', checks.score.has, checks.score.text);
  add('op-symcat = 8 categories', checks.symcat.count === 8 && checks.symcat.allCats, 'count=' + checks.symcat.count + ' cats=' + JSON.stringify(checks.symcat.cats));
  add('emoji icons (8, no placeholder)', checks.icons.count === 8 && checks.icons.allPresent && !checks.icons.hasPlaceholder, checks.icons.list.join(' '));
  add('op-context "อายุ 52"', checks.context.has, JSON.stringify(checks.context));
  add('op-two = 2 columns', checks.two.present && checks.two.cols === 2, 'cols=' + checks.two.cols);
  add('op-care = 4 items', checks.care.count === 4, 'count=' + checks.care.count);
  add('op-talk "ร้อนวูบวาบ"', checks.talk.has, JSON.stringify(checks.talk));
  add('op-footer phone 077-956-789', checks.footer.has, JSON.stringify(checks.footer));

  await browser.close();

  // Report
  const pass = results.filter((r) => r.pass).length;
  const fail = results.length - pass;
  console.log('\n=== CHECKLIST (' + pass + '/' + results.length + ' passed) ===');
  results.forEach((r) => console.log((r.pass ? '  PASS ' : '  FAIL ') + r.name + '  —  ' + r.detail));
  console.log('\nScreenshot: ' + OUT_PNG + (box ? '  (' + Math.round(box.width) + 'x' + Math.round(box.height) + ' px)' : ''));

  if (fail > 0) { console.error('\n' + fail + ' check(s) FAILED'); process.exit(1); }
  console.log('\nAll checks passed.');
})().catch((e) => { console.error(e); process.exit(1); });
