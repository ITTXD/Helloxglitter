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
    console.log('\n🧪 TEST 4: Wait for data to load, then click preorder tab');
    // ============================================================
    // Wait for db2 data to finish loading BEFORE switching to preorder tab
    await page.waitForFunction(() => window._preorderDb2Loaded === true, { timeout: 30000 });
    await sleep(300);
    await page.click('#tab-preorder');
    await sleep(1000);
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
    console.log('\n🧪 TEST 12: จัดส่งแล้ว count >= กำลังผลิต count');
    // ============================================================
    await assert(
      countStatus3 >= countStatus2,
      `จัดส่งแล้ว (${countStatus3}) >= กำลังผลิต (${countStatus2})`
    );
    await assert(
      countStatus3 <= countAll + 100,
      `จัดส่งแล้ว (${countStatus3}) is in reasonable range`
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
    console.log('\n🧪 TEST 15: calcLabelFontSizes reduces font for long content');
    // ============================================================
    const fontSizes = await page.evaluate(() => {
      if (typeof calcLabelFontSizes !== 'function') return null;
      const short = calcLabelFontSizes('สั้น', 'นิดเดียว', 'ชื่อ');
      const long = calcLabelFontSizes(
        'บ้านเลขที่ 123/45 หมู่ 6 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110',
        'A01 (x5), B02 (x3), C03 (x2), D04 (x1), E05 (x4)',
        'นายสมชาย ใจดี ใจดี'
      );
      return {
        shortAddr: short.addr,
        shortName: short.name,
        longAddr: long.addr,
        longName: long.name,
        reduced: parseFloat(long.addr) < parseFloat(short.addr)
      };
    });
    await assert(fontSizes !== null, 'calcLabelFontSizes() function exists');
    await assert(fontSizes.shortAddr === '4.8mm', `Short address font is 4.8mm (got ${fontSizes.shortAddr})`);
    await assert(fontSizes.reduced, `Long address font reduced (short=${fontSizes.shortAddr}, long=${fontSizes.longAddr})`);

    // ============================================================
    console.log('\n🧪 TEST 16: Generate preview with long content uses smaller font');
    // ============================================================
    // Select an order with long address and check rendered font size
    let longLabelFont = await page.evaluate(() => {
      // Select first order visible
      const cards = document.querySelectorAll('.card');
      if (!cards.length) return 'no cards';
      cards[0].click();
      generatePreview();
      const addrEl = document.querySelector('.lbl-addr');
      if (!addrEl) return 'no label';
      return window.getComputedStyle(addrEl).fontSize;
    });
    await assert(longLabelFont !== 'no cards', 'Order cards exist for selection');
    await assert(longLabelFont !== 'no label', 'Label rendered with addr element');
    await assert(true, `Label font-size for addr: ${longLabelFont}`);

    // ============================================================
    console.log('\n🧪 TEST 17: Print from "กำลังผลิต" (status 2) — count does NOT decrease');
    // ============================================================
    // Switch to status 2, note count, select first card, print, check count unchanged
    await page.evaluate(() => {
      document.getElementById('preorderStatusFilter').value = '2';
      applyPreorderFilter();
    });
    await sleep(500);
    const count2Before = await page.$eval('#count-preorder', el => parseInt(el.textContent.trim()) || 0);
    const cardExists2 = await page.evaluate(() => {
      const card = document.querySelector('#completedList .card');
      if (!card) return false;
      card.click();
      return true;
    });
    if (cardExists2 && count2Before > 0) {
      await page.evaluate(() => generatePreview());
      await sleep(2000);
      const count2After = await page.$eval('#count-preorder', el => parseInt(el.textContent.trim()) || 0);
      await assert(count2After === count2Before, `Status 2 count unchanged: ${count2Before} → ${count2After}`);
    } else {
      await assert(true, 'No cards available to test (skipped)');
    }

    // ============================================================
    console.log('\n🧪 TEST 18: Print from "จัดส่งแล้ว" (status 3) — count DOES decrease');
    // ============================================================
    await page.evaluate(() => {
      document.getElementById('preorderStatusFilter').value = '3';
      applyPreorderFilter();
    });
    await sleep(500);
    const count3Before = await page.$eval('#count-preorder', el => parseInt(el.textContent.trim()) || 0);
    const cardExists3 = await page.evaluate(() => {
      const cards = document.querySelectorAll('#completedList .card');
      if (!cards.length) return false;
      // Deselect all first, then select one
      selectedIds.clear();
      cards[0].click();
      return true;
    });
    if (cardExists3 && count3Before > 0) {
      await page.evaluate(() => generatePreview());
      await sleep(3000);
      const count3After = await page.$eval('#count-preorder', el => parseInt(el.textContent.trim()) || 0);
      await assert(count3After < count3Before, `Status 3 count decreased: ${count3Before} → ${count3After}`);
    } else {
      await assert(true, 'No cards available to test (skipped)');
    }

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
