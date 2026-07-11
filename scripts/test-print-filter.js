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

    // Check we're NOT redirected to login
    const currentUrl = page.url();
    await assert(!currentUrl.includes('login'), `Not redirected to login (URL: ${currentUrl})`);

    // ============================================================
    console.log('\n🧪 TEST 2: Preorder tab exists and is clickable');
    // ============================================================
    await page.waitForSelector('#tab-preorder', { timeout: 15000 });
    const tabText = await page.$eval('#tab-preorder', (el) => el.textContent.trim());
    await assert(tabText.includes('พรีออเดอร์'), `Preorder tab found: "${tabText}"`);

    // ============================================================
    console.log('\n🧪 TEST 3: Click preorder tab and wait for data to load');
    // ============================================================
    await page.click('#tab-preorder');
    await sleep(5000); // wait for Firestore query from db2

    const countText = await page.$eval('#count-preorder', (el) => el.textContent.trim());
    await assert(countText !== '...', `Preorder count loaded: ${countText}`);

    // ============================================================
    console.log('\n🧪 TEST 4: No Firestore query errors in console');
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
    console.log('\n🧪 TEST 5: Order cards render (or empty state shown)');
    // ============================================================
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasOrders = bodyText.includes('ไม่ระบุ') || bodyText.includes('📦') || bodyText.includes('✅');
    const hasEmpty = bodyText.includes('ไม่พบ') || countText === '0';
    await assert(
      hasOrders || hasEmpty,
      hasOrders ? 'Orders rendered successfully' : 'Empty state shown (no status==2 orders yet)'
    );

    // ============================================================
    console.log('\n🧪 TEST 6: Source code uses .where("status", "==", 2)');
    // ============================================================
    const filterCorrect = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        if (s.textContent.includes("where('status', '==', 2)")) {
          return true;
        }
      }
      return false;
    });
    await assert(filterCorrect, 'Firestore query uses .where("status", "==", 2)');

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
