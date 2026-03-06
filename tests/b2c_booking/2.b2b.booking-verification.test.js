const { test, expect } = require('@playwright/test');

const B2B_SIGNIN_URL = 'https://crm-dev6.gongbiz.kr/signin';
const EXPECTED_SHOP_NAME = '네이버테스트 30분';
const EXPECTED_BOOKING_TIME = process.env.B2B_EXPECTED_BOOKING_TIME || '12:00';
const EXPECTED_CUSTOMER_NAME = process.env.B2B_EXPECTED_CUSTOMER_NAME || '헤렌테스트#개발자이야이야';
const EXPECTED_SERVICE_NAME = process.env.B2B_EXPECTED_SERVICE_NAME || '손>젤기본';
const EXPECTED_STAFF_NAME = process.env.B2B_EXPECTED_STAFF_NAME || '김제크_직원계정';
const BOOKING_DATE_OFFSET_DAYS = Number(process.env.B2B_BOOKING_DATE_OFFSET_DAYS || '1');

// Test Case: B2B 예약 등록 검증 (B2C 생성 예약 후 확인)
// 사전조건:
// - B2C에서 예약이 생성되어 있어야 함 (기본: 오늘+1일, 12:00, 손>젤기본, 김제크_직원계정)
// - B2B 계정은 샵 리스트에서 대상 샵("네이버테스트 30분")에 접근 가능해야 함
// 검증 시나리오:
// 1) B2B 로그인 -> 마이페이지 이동
// 2) 샵 리스트에서 대상 샵 옆 [샵으로 이동] 클릭
// 3) 좌측 상단 샵명이 대상 샵명과 일치하는지 확인
// 4) 뷰를 리스트로 맞춤 (이미 리스트면 유지)
// 5) 캘린더/리스트 날짜를 BOOKING_DATE_OFFSET_DAYS 기준으로 이동
// 6) 예약 텍스트에서 날짜/시간/고객명/시술명/담당자 4키 매칭 검증

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTargetDateRegex(offsetDays = 1) {
  const target = new Date();
  target.setDate(target.getDate() + offsetDays);

  const yyyy = String(target.getFullYear());
  const yy = yyyy.slice(-2);
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  const m = String(target.getMonth() + 1);
  const d = String(target.getDate());

  return new RegExp(`(${mm}\\.${dd}|${m}\\.${d}|${yy}\\.\\s*${m}\\.\\s*${d}|${yyyy}\\.\\s*${m}\\.\\s*${d})`);
}

function buildServiceRegex(serviceName) {
  const tokens = serviceName.split('>').map((s) => s.trim()).filter(Boolean);
  if (tokens.length < 2) return new RegExp(escapeRegExp(serviceName));
  return new RegExp(tokens.map((s) => escapeRegExp(s)).join('\\s*>\\s*'));
}

test.describe('QA-ZERO B2B 예약 등록 확인', () => {
  test('로그인 > 마이페이지 > 샵 진입 > 리스트 전환 > 예약건 매칭 확인', async ({ page }) => {
    test.setTimeout(180000);
    const finalScreenshotPath =
      process.env.B2B_BOOKING_VERIFY_FINAL_SCREENSHOT_PATH || 'test-results/b2b-booking-verify-final-screen.png';

    const b2bId = process.env.B2B_ID || 'herrenail';
    const b2bPassword = process.env.B2B_PASSWORD || 'gong2023@@';
    const targetDateRegex = buildTargetDateRegex(BOOKING_DATE_OFFSET_DAYS);
    const serviceRegex = buildServiceRegex(EXPECTED_SERVICE_NAME);
    const timeRegex = new RegExp(`(오전|오후)?\\s*${escapeRegExp(EXPECTED_BOOKING_TIME)}`);

    await page.goto(B2B_SIGNIN_URL, { waitUntil: 'domcontentloaded' });

    const idInput = page
      .locator(
        'input[name="loginId"], input[name="id"], input[autocomplete="username"], input[type="text"], input[placeholder*="아이디"]'
      )
      .first();
    await expect(idInput).toBeVisible({ timeout: 20000 });
    await idInput.fill(b2bId);

    const passwordInput = page
      .locator(
        'input[name="password"], input[type="password"], input[autocomplete="current-password"], input[placeholder*="비밀번호"]'
      )
      .first();
    await expect(passwordInput).toBeVisible({ timeout: 20000 });
    await passwordInput.fill(b2bPassword);

    const signinButton = page
      .getByRole('button', { name: /로그인|sign in|signin/i })
      .or(page.getByRole('link', { name: /로그인|sign in|signin/i }))
      .first();
    await expect(signinButton).toBeVisible({ timeout: 15000 });
    await signinButton.click();

    await page.waitForLoadState('networkidle');

    const myPageEntry = page
      .getByRole('link', { name: /마이페이지|마이 페이지|my page|mypage/i })
      .or(page.getByRole('button', { name: /마이페이지|마이 페이지|my page|mypage/i }))
      .or(page.getByText(/마이페이지|마이 페이지/i))
      .first();
    await expect(myPageEntry).toBeVisible({ timeout: 30000 });
    await myPageEntry.click();

    const shopNameCell = page.getByText(new RegExp(`^\\s*${escapeRegExp(EXPECTED_SHOP_NAME)}\\s*$`)).first();
    await expect(shopNameCell).toBeVisible({ timeout: 30000 });

    const moveToShopButton = page
      .locator(
        `xpath=(//*[normalize-space(text())="${EXPECTED_SHOP_NAME}"]/following::*[(self::button or self::a) and contains(normalize-space(.), "샵으로 이동")])[1]`
      )
      .first();
    await expect(moveToShopButton).toBeVisible({ timeout: 30000 });

    const urlBeforeMove = page.url();
    await moveToShopButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForURL((url) => url.toString() !== urlBeforeMove, { timeout: 10000 }).catch(() => {});

    const topLeftShopName = page
      .locator('header, [class*="header"], [class*="top"], [class*="shop"]')
      .getByText(new RegExp(escapeRegExp(EXPECTED_SHOP_NAME)))
      .first();

    if (await topLeftShopName.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(topLeftShopName).toBeVisible({ timeout: 30000 });
    } else {
      const firstVisibleShopName = page.getByText(new RegExp(escapeRegExp(EXPECTED_SHOP_NAME))).first();
      await expect(firstVisibleShopName).toBeVisible({ timeout: 30000 });
    }

    const listViewButton = page
      .getByRole('button', { name: /^리스트$/ })
      .or(page.getByRole('tab', { name: /^리스트$/ }))
      .or(page.getByRole('link', { name: /^리스트$/ }))
      .first();
    await expect(listViewButton).toBeVisible({ timeout: 30000 });

    const isListActive = await listViewButton.evaluate((el) => {
      const ariaSelected = el.getAttribute('aria-selected');
      const ariaCurrent = el.getAttribute('aria-current');
      const className = el.getAttribute('class') || '';
      return ariaSelected === 'true' || ariaCurrent === 'page' || /active|selected|on/.test(className);
    });
    if (!isListActive) {
      await listViewButton.click();
      await page.waitForLoadState('networkidle');
    }

    const scheduleRoot = page.locator('main').first();
    await expect(scheduleRoot).toBeVisible({ timeout: 30000 });

    const todayButton = scheduleRoot.locator('.fc-today-button').first();
    if (
      (await todayButton.isVisible({ timeout: 2000 }).catch(() => false)) &&
      (await todayButton.isEnabled().catch(() => false))
    ) {
      await todayButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(200);
    }

    const moveButton = scheduleRoot
      .locator(BOOKING_DATE_OFFSET_DAYS >= 0 ? '.fc-next-button' : '.fc-prev-button')
      .first();
    const maxMoves = Math.max(Math.abs(BOOKING_DATE_OFFSET_DAYS), 0);
    let boardText = (await scheduleRoot.innerText()).replace(/\s+/g, ' ').trim();
    let dateMatched = false;

    for (let step = 0; step < maxMoves; step += 1) {
      if (targetDateRegex.test(boardText)) {
        dateMatched = true;
        break;
      }

      if (!(await moveButton.isVisible({ timeout: 1000 }).catch(() => false))) break;
      await moveButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(250);
      boardText = (await scheduleRoot.innerText()).replace(/\s+/g, ' ').trim();
    }

    if (targetDateRegex.test(boardText)) dateMatched = true;

    expect(
      dateMatched,
      `타겟 날짜로 이동 실패: 날짜오프셋=${BOOKING_DATE_OFFSET_DAYS}, 날짜패턴=${targetDateRegex}, 본문=${boardText}`
    ).toBeTruthy();

    const datePart = targetDateRegex.source;
    const timePart = timeRegex.source;
    const customerPart = escapeRegExp(EXPECTED_CUSTOMER_NAME.slice(0, 4));
    const servicePart = serviceRegex.source;
    const staffPart = escapeRegExp(EXPECTED_STAFF_NAME);
    const bookingPattern = new RegExp(
      `${datePart}.*?${timePart}.*?${customerPart}.*?${servicePart}.*?(담당자\\s*)?${staffPart}`,
      'i'
    );

    expect(
      bookingPattern.test(boardText),
      `타겟 예약건 매칭 실패: 날짜오프셋=${BOOKING_DATE_OFFSET_DAYS}, 패턴=${bookingPattern}, 본문=${boardText}`
    ).toBeTruthy();

    // 예약 리스트에서 타겟 예약 클릭 -> [예약 상세 정보] 진입 강제 검증
    const bookingRowPattern = new RegExp(
      `${timePart}.*?${customerPart}.*?${servicePart}|${customerPart}.*?${timePart}.*?${servicePart}`,
      'i'
    );
    const bookingRow = scheduleRoot
      .locator('.fc-list-event, .fc-event, [class*="booking"], [class*="event"], tr, li')
      .filter({ hasText: bookingRowPattern })
      .first();
    await expect(bookingRow).toBeVisible({ timeout: 30000 });
    await bookingRow.click({ force: true }).catch(async () => {
      await bookingRow.evaluate((el) => el.click()).catch(() => {});
    });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(400);

    const detailHeading = page.getByText(/예약 상세 정보/).first();
    await expect(detailHeading).toBeVisible({ timeout: 30000 });

    const detailRoot = page
      .locator('section, aside, div')
      .filter({ has: detailHeading })
      .or(
        page
          .locator('section, aside, div')
          .filter({ hasText: /예약 상세 정보/i })
          .filter({ hasText: /예약일시|예약 일시/i })
          .filter({ hasText: /담당자/i })
          .filter({ hasText: /시술메뉴|시술 메뉴/i })
      )
      .first();
    await expect(detailRoot).toBeVisible({ timeout: 30000 });

    const detailText = (await detailRoot.innerText()).replace(/\s+/g, ' ').trim();
    const detailDateTimeRegex = new RegExp(`${datePart}.*?${timePart}|${timePart}.*?${datePart}`, 'i');
    const detailStaffRegex = new RegExp(`(담당자\\s*)?${staffPart}`, 'i');
    const detailServiceRegex = serviceRegex;

    expect(
      detailDateTimeRegex.test(detailText),
      `상세 예약일시 매칭 실패: 패턴=${detailDateTimeRegex}, 본문=${detailText}`
    ).toBeTruthy();
    expect(
      detailStaffRegex.test(detailText),
      `상세 담당자 매칭 실패: 패턴=${detailStaffRegex}, 본문=${detailText}`
    ).toBeTruthy();
    expect(
      detailServiceRegex.test(detailText),
      `상세 시술메뉴 매칭 실패: 패턴=${detailServiceRegex}, 본문=${detailText}`
    ).toBeTruthy();

    await page.screenshot({ path: finalScreenshotPath, fullPage: true });
  });
});
