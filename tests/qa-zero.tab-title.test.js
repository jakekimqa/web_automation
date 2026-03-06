const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const AUTH_STATE_PATH = path.resolve(__dirname, '../playwright/.auth/user.json');

test.use({
  geolocation: { latitude: 37.5446, longitude: 127.0562 },
  permissions: ['geolocation']
});

async function findShopInList(page, shopName) {
  if (page.url().includes('/cok')) {
    await page.goto('https://qa-zero.gongbiz.kr/nearby', { waitUntil: 'domcontentloaded' });
    const reopenList = page.getByRole('button', { name: '목록보기' }).first();
    if (await reopenList.isVisible().catch(() => false)) await reopenList.click();
  }

  const directTarget = page.getByText(shopName).first();
  if (await directTarget.isVisible().catch(() => false)) {
    await directTarget.click();
    return true;
  }

  const searchInput = page
    .getByPlaceholder(/검색|샵|매장|미용실|네일/i)
    .or(page.locator('input[type="search"]'))
    .or(page.locator('input[type="text"]'))
    .first();
  if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchInput.fill(shopName);
    await page.keyboard.press('Enter').catch(() => {});
    if (await directTarget.isVisible({ timeout: 5000 }).catch(() => false)) {
      await directTarget.click();
      return true;
    }
  }

  for (let i = 0; i < 35; i += 1) {
    if (await directTarget.isVisible().catch(() => false)) {
      await directTarget.click();
      return true;
    }

    const targetPanel = page.locator('div.flex.min-h-0.flex-1.flex-col').first();
    if (await targetPanel.isVisible().catch(() => false)) {
      await targetPanel.evaluate((el) => {
        el.scrollBy(0, 950);
      });
    }

    await page.waitForTimeout(250);
  }
  return false;
}

async function openShopDetail(page, shopName) {
  for (let i = 0; i < 4; i += 1) {
    if (page.url().includes('/cok')) {
      await page.goto('https://qa-zero.gongbiz.kr/nearby', { waitUntil: 'domcontentloaded' });
      const reopenList = page.getByRole('button', { name: '목록보기' }).first();
      if (await reopenList.isVisible().catch(() => false)) await reopenList.click();
      await findShopInList(page, shopName);
    }

    const detailReady =
      (await page.getByRole('button', { name: '예약하기' }).first().isVisible().catch(() => false)) ||
      (await page.getByText(/시술|메뉴/).first().isVisible().catch(() => false));
    if (detailReady) return true;

    const shopCard = page.locator(`button:has(h2:has-text("${shopName}")), button:has-text("${shopName}")`).first();
    if (await shopCard.isVisible().catch(() => false)) {
      await shopCard.click({ force: true }).catch(async () => {
        await shopCard.evaluate((el) => el.click()).catch(() => {});
      });
    }
    await page.waitForTimeout(700);
  }
  return false;
}

async function gotoWithRetry(page, url, tries = 5) {
  for (let i = 0; i < tries; i += 1) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    if (!/503/i.test(title)) return;
    await page.waitForTimeout(3000);
  }
  throw new Error('사이트가 503 상태에서 복구되지 않았습니다.');
}

// Test Case: QA-ZERO 로그인/관심샵 확인 후 내주변 예약까지 연속 E2E
// 사전조건:
// - 매 실행마다 로그인 프로세스를 처음부터 수행
// - 테스트 계정: developer@herren.co.kr / herren3378!
// - geolocation: 성수 인근 고정 (37.5446, 127.0562)
// - 사이트 503 응답 시 재시도 후 진행
// 검증 시나리오:
// 1) 메인 진입 + 탭 제목 확인
// 2) 마이 > 로그인/회원가입 > 카카오 로그인 (DKAPTCHA 발생 시 실패)
// 3) 홈에서 "헤렌테스트님의 관심샵" 확인
// 4) /nearby 직접 진입 후 목록보기에서 "네이버테스트 30분" 탐색/상세 진입
// 5) 시술 "손 > 젤기본" 선택, 예약금 0원 확인
// 6) 담당자 "김제크_직원계정 담당자" 선택
// 7) 날짜는 내일(오늘+1일) 선택
// 8) 시간은 12:00 우선, 없으면 오후 첫 가용 시간 선택
// 9) 결제에서 예약정보(필요 시 토글) / 금액 0원 / 요청사항 입력 확인 후 예약
// 10) 완료 화면에서 완료 문구 + 샵/담당자/시간 정보 확인
test('qa-zero 로그인 후 관심샵 확인 + 내주변 예약 연속 플로우', async ({ page, context }) => {
  test.setTimeout(300000);

  const kakaoId = process.env.KAKAO_ID || 'developer@herren.co.kr';
  const kakaoPassword = process.env.KAKAO_PASSWORD || 'herren3378!';

  await gotoWithRetry(page, 'https://qa-zero.gongbiz.kr/', 6);

  const tabTitle = await page.title();
  console.log('Tab title:', tabTitle);
  expect(tabTitle.trim().length).toBeGreaterThan(0);

  const myMenu = page.getByRole('link', { name: '마이' }).or(page.getByRole('button', { name: '마이' })).first();
  await expect(myMenu).toBeVisible();
  await myMenu.click();

  const loginEntry = page.getByRole('link', { name: '로그인 / 회원가입' }).first();
  await expect(loginEntry).toBeVisible({ timeout: 15000 });
  await loginEntry.click();

  const kakaoLoginTrigger = page
    .getByRole('link', { name: /카카오/i })
    .or(page.getByRole('button', { name: /카카오/i }))
    .or(page.getByText(/카카오/i))
    .first();
  await expect(kakaoLoginTrigger).toBeVisible({ timeout: 15000 });

  const popupPromise = context.waitForEvent('page', { timeout: 10000 }).catch(() => null);
  await kakaoLoginTrigger.click();
  const kakaoPopup = await popupPromise;

  const kakaoPage = kakaoPopup || page;
  await kakaoPage.waitForLoadState('domcontentloaded');

  await kakaoPage
    .locator('input[name="loginId"], input[type="email"], input[autocomplete="username"]')
    .first()
    .fill(kakaoId);
  await kakaoPage
    .locator('input[name="password"], input[type="password"], input[autocomplete="current-password"]')
    .first()
    .fill(kakaoPassword);

  const kakaoSubmit = kakaoPage
    .getByRole('button', { name: /로그인|log ?in/i })
    .or(kakaoPage.locator('input[type="submit"]'))
    .first();
  await kakaoSubmit.click();

  const dKaptcha = kakaoPage.getByText(/DKAPTCHA|Please answer the following question/i).first();
  if (await dKaptcha.isVisible({ timeout: 3000 }).catch(() => false)) {
    throw new Error('카카오 DKAPTCHA가 발생해 자동 로그인을 진행할 수 없습니다.');
  }

  if (kakaoPopup) {
    const consentButton = kakaoPopup
      .getByRole('button', { name: /동의|허용|continue|allow/i })
      .or(kakaoPopup.getByRole('link', { name: /동의|허용|continue|allow/i }))
      .first();
    if (await consentButton.isVisible().catch(() => false)) {
      await consentButton.click();
    }

    await kakaoPopup.waitForEvent('close', { timeout: 30000 }).catch(() => {});
    await page.bringToFront();
  }

  await page.waitForLoadState('networkidle');
  const homeTab = page.getByRole('link', { name: '홈' }).or(page.getByRole('button', { name: '홈' })).first();
  await expect(homeTab).toBeVisible({ timeout: 30000 });
  await homeTab.click();

  await expect(page.getByText('헤렌테스트님의 관심샵')).toBeVisible({ timeout: 30000 });

  fs.mkdirSync(path.dirname(AUTH_STATE_PATH), { recursive: true });
  await page.context().storageState({ path: AUTH_STATE_PATH });

  const shopName = '네이버테스트 30분';
  const staffName = '김제크_직원계정 담당자';
  const preferredBookingTime = '12:00';
  let selectedBookingTime = preferredBookingTime;
  const requestNote = '자동화 테스트 코덱스 이용하기';

  await page.goto('https://qa-zero.gongbiz.kr/nearby', { waitUntil: 'domcontentloaded' });

  const dismissLocationUi = page
    .getByRole('button', { name: /닫기|나중에|취소|다음에|허용 안 함|허용안함/i })
    .or(page.getByRole('link', { name: /닫기|나중에|취소|다음에/i }))
    .first();
  if (await dismissLocationUi.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dismissLocationUi.click().catch(() => {});
  }

  const listButton = page.getByRole('button', { name: '목록보기' }).first();
  await expect(listButton).toBeVisible({ timeout: 15000 });
  await listButton.click();

  const found = await findShopInList(page, shopName);
  expect(found, `"${shopName}" 샵을 목록에서 찾지 못했습니다.`).toBeTruthy();

  const entered = await openShopDetail(page, shopName);
  expect(entered, `"${shopName}" 샵 상세 진입에 실패했습니다.`).toBeTruthy();

  await expect(page.getByText(shopName).first()).toBeVisible({ timeout: 30000 });

  await page.getByText('손').first().click();
  await page.getByText('젤기본').first().click();
  await expect(page.getByText('예약금 0원').first()).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: '예약하기' }).first().click();

  const staffRow = page.getByRole('listitem').filter({ hasText: staffName }).first();
  await expect(staffRow).toBeVisible({ timeout: 30000 });
  await staffRow.getByRole('button', { name: '선택' }).click();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = String(tomorrow.getDate());
  const tomorrowMonthDay = `${tomorrow.getMonth() + 1}\\.${tomorrow.getDate()}`;
  const dayOption = page
    .locator('button:not([disabled])')
    .filter({ hasText: new RegExp(`^(${tomorrowMonthDay}|${tomorrowDay})$`) })
    .first();
  await expect(dayOption).toBeVisible({ timeout: 30000 });
  await dayOption.click();

  const preferredTimeOption = page.getByRole('button', { name: new RegExp(`^${preferredBookingTime}$`) }).first();
  if (await preferredTimeOption.isVisible({ timeout: 2000 }).catch(() => false)) {
    await preferredTimeOption.click();
  } else {
    const fallbackTimeOption = page
      .locator('p:has-text("오후")')
      .locator('xpath=following-sibling::*[1]//button[not(@disabled)]')
      .first();
    await expect(fallbackTimeOption).toBeVisible({ timeout: 30000 });
    selectedBookingTime = (await fallbackTimeOption.innerText()).trim();
    await fallbackTimeOption.click();
  }
  await page.getByRole('button', { name: '예약하기' }).first().click();

  expect(page.url()).toContain('qa-zero.gongbiz.kr');
  await expect(page.getByText(shopName).first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/예약 정보|예약정보/).first()).toBeVisible({ timeout: 30000 });

  const staffInfo = page.getByText(staffName).first();
  if (!(await staffInfo.isVisible({ timeout: 1500 }).catch(() => false))) {
    const bookingInfoHeader = page
      .locator('h2')
      .filter({ hasText: /예약 정보|예약정보/ })
      .first()
      .locator('xpath=..');
    await bookingInfoHeader.click().catch(() => {});
  }
  await expect(staffInfo).toBeVisible({ timeout: 30000 });

  await expect(page.getByText(new RegExp(`${selectedBookingTime}|오후\\s*${selectedBookingTime}`)).first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/지금 결제할 금액\s*0원|0원/).first()).toBeVisible({ timeout: 30000 });

  const requestInput = page
    .getByPlaceholder(/요청사항|요청 사항/i)
    .or(page.locator('textarea'))
    .or(page.locator('input[type="text"]'))
    .first();
  await requestInput.fill(requestNote);

  await page.getByRole('button', { name: '예약하기' }).first().click();
  await expect(page.getByText(/예약 완료\s*되었어요\./).first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('예약일에 만나요').first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(shopName).first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(staffName).first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(new RegExp(`${selectedBookingTime}|오후\\s*${selectedBookingTime}`)).first()).toBeVisible({ timeout: 30000 });
});
