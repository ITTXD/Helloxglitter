const puppeteer = require('puppeteer');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let passed = 0;
let failed = 0;

async function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL: ${message}`);
  }
}

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(String(err.message || err));
    });

    // Set auth before navigating
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.setItem('helloxglitter_auth', 'true');
    });

    // ============================================================
    console.log('\n🧪 TEST 1: print.html loads without errors');
    // ============================================================
    const res = await page.goto(`${BASE_URL}/print.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await assert(res && res.status() < 400, `Page returns status ${res ? res.status() : 'N/A'}`);

    await page.waitForFunction(() => !!document && !!document.body, { timeout: 30000 });
    await assert(true, 'Page body is ready');

    const currentUrl = page.url();
    await assert(!currentUrl.includes('login'), `Not redirected to login (URL: ${currentUrl})`);

    // ============================================================
    console.log('\n🧪 TEST 2: Preorder tab exists');
    // ============================================================
    await page.waitForSelector('#tab-preorder', { timeout: 15000 });
    const tabText = await page.$eval('#tab-preorder', (el) => el.textContent.trim());
    await assert(tabText.includes('พรีออเดอร์'), `Preorder tab found: "${tabText}"`);

    // ============================================================
    console.log('\n🧪 TEST 3: Status filter dropdown exists');
    // ============================================================
    await page.waitForSelector('#preorderStatusFilter', { timeout: 10000 });
    const dropdownExists = await page.$('#preorderStatusFilter') !== null;
    await assert(dropdownExists, 'Dropdown #preorderStatusFilter exists');

    // ============================================================
    console.log('\n🧪 TEST 4: Click preorder tab — dropdown appears');
    // ============================================================
    await page.click('#tab-preorder');
    await sleep(3000);
    const dropdownVisible = await page.$eval('#preorderStatusFilter', el => {
      return window.getComputedStyle(el).display !== 'none';
    });
    await assert(dropdownVisible, 'Dropdown is visible after clicking preorder tab');

    // ============================================================
    console.log('\n🧪 TEST 5: Dropdown has correct options');
    // ============================================================
    const options = await page.$$eval('#preorderStatusFilter option', els =>
      els.map(el => ({ value: el.value, text: el.textContent.trim() }))
    );
    const hasAllOption = options.some(o => o.value === 'all' && o.text.includes('ทั้งหมด'));
    const hasStatus2Option = options.some(o => o.value === '2' && o.text.includes('กำลังผลิต'));
    const hasStatus3Option = options.some(o => o.value === '3' && o.text.includes('จัดส่งแล้ว'));
    await assert(hasAllOption, `Dropdown has "ทั้งหมด" option`);
    await assert(hasStatus2Option, `Dropdown has "กำลังผลิต" option`);
    await assert(hasStatus3Option, `Dropdown has "จัดส่งแล้ว" option`);
    await assert(options.length === 3, `Dropdown has exactly 3 options (got ${options.length})`);

    // ============================================================
    console.log('\n🧪 TEST 6: Default selected value is "2"');
    // ============================================================
    const defaultValue = await page.$eval('#preorderStatusFilter', el => el.value);
    await assert(defaultValue === '2', `Default value is "2" (got: "${defaultValue}")`);

    // ============================================================
    console.log('\n🧪 TEST 7: Preorder data loads (default filter = กำลังผลิต)');
    // ============================================================
    // Wait for Firestore data to finish loading via _preorderDb2Loaded flag
    await page.waitForFunction(() => window._preorderDb2Loaded === true, { timeout: 30000 });
    await sleep(500);
    const countText = await page.$eval('#count-preorder', (el) => el.textContent.trim());
    await assert(true, `Preorder data loaded. Count: ${countText}`);

    // ============================================================
    console.log('\n🧪 TEST 8: No Firestore query errors in console');
    // ============================================================
    const firestoreErrors = consoleErrors.filter(
      (e) =>
        e.includes('index') ||
        e.includes('FAILED_PRECONDITION') ||
        e.includes('permission-denied')
    );
    await assert(
      firestoreErrors.length === 0,
      firestoreErrors.length === 0
        ? 'No Firestore query errors'
        : `Firestore errors: ${firestoreErrors.join('; ')}`
    );

    // ============================================================
    console.log('\n🧪 TEST 9: Switch to "ทั้งหมด" — count >= กำลังผลิต count');
    // ============================================================
    const countBefore = parseInt(countText) || 0;
    await page.evaluate(() => {
      document.getElementById('preorderStatusFilter').value = 'all';
      applyPreorderFilter();
    });
    await sleep(500);
    const countAll = await page.$eval('#count-preorder', (el) => parseInt(el.textContent.trim()) || 0);
    await assert(
      countAll >= countBefore,
      `Count "ทั้งหมด" (${countAll}) >= "กำลังผลิต" (${countBefore})`
    );

    // ============================================================
    console.log('\n🧪 TEST 10: Switch to "กำลังผลิต" — count <= "ทั้งหมด"');
    // ============================================================
    await page.evaluate(() => {
      document.getElementById('preorderStatusFilter').value = '2';
      applyPreorderFilter();
    });
    await sleep(500);
    const countStatus2 = await page.$eval('#count-preorder', (el) => parseInt(el.textContent.trim()) || 0);
    await assert(
      countStatus2 <= countAll,
      `Count "กำลังผลิต" (${countStatus2}) <= "ทั้งหมด" (${countAll})`
    );

    // ============================================================
    console.log('\n🧪 TEST 11: Switch to "จัดส่งแล้ว" — count <= "ทั้งหมด"');
    // ============================================================
    await page.evaluate(() => {
      document.getElementById('preorderStatusFilter').value = '3';
      applyPreorderFilter();
    });
    await sleep(500);
    const countStatus3 = await page.$eval('#count-preorder', (el) => parseInt(el.textContent.trim()) || 0);
    await assert(
      countStatus3 <= countAll,
      `Count "จัดส่งแล้ว" (${countStatus3}) <= "ทั้งหมด" (${countAll})`
    );

    // ============================================================
    console.log('\n🧪 TEST 12: กำลังผลิต + จัดส่งแล้ว <= "ทั้งหมด"');
    // ============================================================
    await assert(
      countStatus2 + countStatus3 <= countAll,
      `กำลังผลิต (${countStatus2}) + จัดส่งแล้ว (${countStatus3}) <= "ทั้งหมด" (${countAll})`
    );

    // ============================================================
    console.log('\n🧪 TEST 13: No hardcoded Firestore status filter in source');
    // ============================================================
    const noHardcodedFilter = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        if (s.textContent.includes("where('status', '==', 2)")) {
          return false;
        }
      }
      return true;
    });
    await assert(noHardcodedFilter, 'No hardcoded .where("status", "==", 2) in source');

    // ============================================================
    console.log('\n🧪 TEST 14: applyPreorderFilter function exists');
    // ============================================================
    const hasFilterFn = await page.evaluate(() => {
      return typeof window.applyPreorderFilter === 'function';
    });
    await assert(hasFilterFn, 'applyPreorderFilter() function exists');

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('\n' + '='.repeat(50));
    console.log(`RESULTS: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('TEST SUITE ERROR:', err && err.stack ? err.stack : String(err));
  process.exitCode = 1;
});
