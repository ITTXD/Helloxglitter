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
    await page.setViewport({ width: 1280, height: 900 });

    const consoleLogs = [];
    const consoleErrors = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLogs.push(text);
      if (msg.type() === 'error') consoleErrors.push(text);
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err.message || err)));

    // Set auth before navigating
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => {
      localStorage.setItem('helloxglitter_auth', 'true');
    });

    // ============================================================
    console.log('\n🧪 TEST 1: print.html loads successfully');
    // ============================================================
    const res = await page.goto(`${BASE_URL}/print.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await assert(res && res.status() < 400, `Page status: ${res ? res.status() : 'N/A'}`);

    // ============================================================
    console.log('\n🧪 TEST 2: Firebase 2 (db2) initializes');
    // ============================================================
    await sleep(3000);
    const db2Initialized = await page.evaluate(() => typeof window.db2 !== 'undefined' && window.db2 !== null);
    await assert(db2Initialized, 'window.db2 is defined and not null');

    // ============================================================
    console.log('\n🧪 TEST 3: Preorder tab exists and clickable');
    // ============================================================
    await page.waitForSelector('#tab-preorder', { timeout: 15000 });
    const preorderTab = await page.$('#tab-preorder');
    await assert(preorderTab !== null, 'Preorder tab #tab-preorder exists');

    // ============================================================
    console.log('\n🧪 TEST 4: Click preorder tab — loads data from db2');
    // ============================================================
    await page.click('#tab-preorder');
    await sleep(5000); // Wait for Firestore query
    const preorderCount = await page.$eval('#count-preorder', el => el.textContent.trim());
    await assert(
      preorderCount !== '...' && preorderCount !== '!',
      `Preorder count loaded: ${preorderCount}`
    );

    // ============================================================
    console.log('\n🧪 TEST 5: Preorder list renders items from db2');
    // ============================================================
    const listHasCards = await page.evaluate(() => {
      const list = document.getElementById('completedList');
      return list && list.querySelectorAll('.card').length > 0;
    });
    await assert(listHasCards, 'Preorder list has at least 1 card');

    // ============================================================
    console.log('\n🧪 TEST 6: Status filter dropdown works for db2 data');
    // ============================================================
    const dropdownVisible = await page.$eval('#preorderStatusFilter', el => {
      return window.getComputedStyle(el).display !== 'none';
    });
    await assert(dropdownVisible, 'Status filter dropdown is visible in preorder tab');

    // ============================================================
    console.log('\n🧪 TEST 7: Default selected value is "2" (กำลังผลิต)');
    // ============================================================
    const defaultValue = await page.$eval('#preorderStatusFilter', el => el.value);
    await assert(defaultValue === '2', `Default value is "2" (got: "${defaultValue}")`);

    // ============================================================
    console.log('\n🧪 TEST 8: Switch to "ทั้งหมด" — count >= status 3 count');
    // ============================================================
    const countBefore = parseInt(preorderCount) || 0;
    await page.select('#preorderStatusFilter', 'all');
    await sleep(2000);
    const countAll = await page.$eval('#count-preorder', el => parseInt(el.textContent.trim()) || 0);
    await assert(
      countAll >= countBefore,
      `Count "ทั้งหมด" (${countAll}) >= "Status 3" (${countBefore})`
    );

    // ============================================================
    console.log('\n🧪 TEST 9: Switch back to "Status 3" — count <= "ทั้งหมด"');
    // ============================================================
    await page.select('#preorderStatusFilter', '3');
    await sleep(2000);
    const countStatus3 = await page.$eval('#count-preorder', el => parseInt(el.textContent.trim()) || 0);
    await assert(
      countStatus3 <= countAll,
      `Count "Status 3" (${countStatus3}) <= "ทั้งหมด" (${countAll})`
    );

    // ============================================================
    console.log('\n🧪 TEST 10: Select a card and generate preview from db2 data');
    // ============================================================
    const firstCardId = await page.evaluate(() => {
      const card = document.querySelector('.card');
      if (!card) return null;
      card.click();
      return card.id;
    });
    await assert(firstCardId !== null, `Selected first card: ${firstCardId}`);

    if (firstCardId) {
      await sleep(500);
      // Click generate preview button
      await page.evaluate(() => {
        const btns = document.querySelectorAll('.bb.bb-p');
        for (const b of btns) {
          if (b.textContent.includes('สร้างใบปริ้น')) {
            b.click();
            break;
          }
        }
      });
      await sleep(2000);

      const previewHasLabels = await page.evaluate(() => {
        const area = document.getElementById('previewArea');
        return area && area.querySelectorAll('.lbl-wrap').length > 0;
      });
      await assert(previewHasLabels, 'Preview area shows labels after generating from db2 data');
    }

    // ============================================================
    console.log('\n🧪 TEST 11: Print from "กำลังผลิต" (status 2 default) — count does NOT decrease');
    // ============================================================
    await page.evaluate(() => {
      document.getElementById('preorderStatusFilter').value = '2';
      applyPreorderFilter();
    });
    await sleep(500);
    const count2Before = await page.$eval('#count-preorder', el => parseInt(el.textContent.trim()) || 0);
    const card2 = await page.evaluate(() => {
      const cards = document.querySelectorAll('#completedList .card');
      if (!cards.length) return null;
      selectedIds.clear();
      cards[0].click();
      return cards[0].id;
    });
    if (card2 && count2Before > 0) {
      await page.evaluate(() => generatePreview());
      await sleep(2000);
      const count2After = await page.$eval('#count-preorder', el => parseInt(el.textContent.trim()) || 0);
      await assert(count2After === count2Before, `Status 2 count unchanged: ${count2Before} → ${count2After}`);
    } else {
      await assert(true, 'No cards available to test status 2 (skipped)');
    }

    // ============================================================
    console.log('\n🧪 TEST 12: Print from "จัดส่งแล้ว" (status 3) — count DOES decrease');
    // ============================================================
    await page.evaluate(() => {
      document.getElementById('preorderStatusFilter').value = '3';
      applyPreorderFilter();
    });
    await sleep(500);
    const count3Before = await page.$eval('#count-preorder', el => parseInt(el.textContent.trim()) || 0);
    const card3 = await page.evaluate(() => {
      const cards = document.querySelectorAll('#completedList .card');
      if (!cards.length) return null;
      selectedIds.clear();
      cards[0].click();
      return cards[0].id;
    });
    if (card3 && count3Before > 0) {
      await page.evaluate(() => generatePreview());
      await sleep(3000);
      const count3After = await page.$eval('#count-preorder', el => parseInt(el.textContent.trim()) || 0);
      await assert(count3After < count3Before, `Status 3 count decreased: ${count3Before} → ${count3After}`);
    } else {
      await assert(true, 'No cards available to test status 3 (skipped)');
    }

    // ============================================================
    console.log('\n🧪 TEST 13: Switch back to main tab — data still loads');
    // ============================================================
    await page.click('#tab-main');
    await sleep(2000);
    const mainCount = await page.$eval('#count-main', el => el.textContent.trim());
    await assert(mainCount !== '!' && mainCount !== '...', `Main tab count: ${mainCount}`);

    // ============================================================
    console.log('\n🧪 TEST 14: No critical Firestore errors in console');
    // ============================================================
    const criticalErrors = consoleErrors.filter(
      e => e.includes('permission-denied') || e.includes('unauthenticated')
    );
    await assert(
      criticalErrors.length === 0,
      criticalErrors.length === 0
        ? 'No Firestore permission errors'
        : `Permission errors: ${criticalErrors.join('; ')}`
    );

    // ============================================================
    console.log('\n🧪 TEST 15: db2 Firestore collection "orders" queryable');
    // ============================================================
    const db2QueryOk = await page.evaluate(async () => {
      if (typeof db2 === 'undefined' || !db2) return false;
      try {
        const snap = await db2.collection('orders').limit(1).get();
        return !snap.empty || snap.size === 0;
      } catch (e) {
        return false;
      }
    });
    await assert(db2QueryOk, 'db2 Firestore "orders" collection is queryable');

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log(`  🖨️  PRINT SYSTEM DB2 TEST RESULTS: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(60));

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
