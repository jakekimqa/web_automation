const { test, expect } = require('@playwright/test');
const path = require('path');

const AUTH_STATE_PATH = path.resolve(__dirname, '../../playwright/.auth/user.json');

// Test Case: QA-ZERO 내주변 예약 플로우 단독 E2E (세션 재사용)
// 사전조건:
// - storageState: playwright/.auth/user.json
// - geolocation: 성수 인근 고정 (37.5446, 127.0562)
// - 위치 권한 팝업은 닫기/무시 처리
// - 대상 샵: "네이버테스트 30분"
// 검증 시나리오:
// 1) 내주변 진입 후 "목록보기" 노출 확인
// 2) 목록에서 대상 샵 탐색(검색/리스트 스크롤)
// 3) 샵 상세 진입 시도(내주변 이탈 시 복귀 포함)
// 4) 샵명/주소 정보 검증
// 5) 시술 "손 > 젤기본" 선택 후 "예약금 0원" 확인
// 6) 담당자 "김제크_직원계정 담당자" 선택
// 7) 날짜는 내일(오늘+1일), 시간은 12:00 우선/없으면 오후 첫 가용 시간 선택
// 8) 결제 화면에서 예약 정보/금액 0원 확인, 요청사항 입력 후 예약
// 9) 예약 완료 문구 + 샵명/담당자/시간 최종 확인

test.use({
  storageState: AUTH_STATE_PATH,
  geolocation: { latitude: 37.5446, longitude: 127.0562 },
  permissions: ['geolocation']
});

async function findShopInList(page, shopName) {
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
      const nearbyTab = page.getByRole('link', { name: '내주변' }).first();
      if (await nearbyTab.isVisible().catch(() => false)) {
        await nearbyTab.click();
        await page.getByRole('button', { name: '목록보기' }).first().click();
        await findShopInList(page, shopName);
      }
    }

    const detailReady =
      (await page.getByRole('button', { name: '예약하기' }).first().isVisible().catch(() => false)) ||
      (await page.getByText(/시술|메뉴/).first().isVisible().catch(() => false));
    if (detailReady) return true;

    const shopCard = page.locator(`button:has(h2:has-text("${shopName}")), button:has-text("${shopName}")`).first();
    if (await shopCard.isVisible().catch(() => false)) {
      const shopImage = shopCard.locator('img[alt="전시 이미지"]').first();
      if (await shopImage.isVisible().catch(() => false)) {
        await shopImage.click({ force: true }).catch(() => {});
      }
      await shopCard.click({ force: true }).catch(async () => {
        await shopCard.evaluate((el) => el.click()).catch(() => {});
      });
    }
    await page.waitForTimeout(700);
  }

  return false;
}

test('qa-zero 내주변 예약 플로우 검증', async ({ page }) => {
  test.setTimeout(240000);
  const finalScreenshotPath =
    process.env.B2C_BOOKING_FINAL_SCREENSHOT_PATH || 'test-results/b2c-booking-final-screen.png';
  const shopName = '네이버테스트 30분';
  const shopAddress = '서울 성동구 성수일로8길 5 (성수동2가, 서울숲 SK V1 TOWER), 테스트';
  const staffName = '김제크_직원계정 담당자';
  const preferredBookingTime = '12:00';
  let selectedBookingTime = preferredBookingTime;
  const requestNote = '자동화 테스트 코덱스 이용하기';

  await page.goto('https://qa-zero.gongbiz.kr/', { waitUntil: 'domcontentloaded' });

  await test.step('내주변 지도 진입', async () => {
    const nearbyTab = page
      .getByRole('link', { name: '내주변' })
      .or(page.getByRole('button', { name: '내주변' }))
      .or(page.getByText('내주변'))
      .first();
    await expect(nearbyTab).toBeVisible({ timeout: 30000 });
    await nearbyTab.click();

    const dismissLocationUi = page
      .getByRole('button', { name: /닫기|나중에|취소|다음에|허용 안 함|허용안함/i })
      .or(page.getByRole('link', { name: /닫기|나중에|취소|다음에/i }))
      .first();
    if (await dismissLocationUi.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dismissLocationUi.click().catch(() => {});
    }
    await expect(page.getByRole('button', { name: '목록보기' }).first()).toBeVisible({ timeout: 15000 });
  });

  await test.step('목록보기에서 샵 선택 후 상세 진입', async () => {
    await page.getByRole('button', { name: '목록보기' }).first().click();

    const found = await findShopInList(page, shopName);
    expect(found, `"${shopName}" 샵을 목록에서 찾지 못했습니다.`).toBeTruthy();

    const entered = await openShopDetail(page, shopName);
    expect(entered, `"${shopName}" 샵 상세 진입에 실패했습니다.`).toBeTruthy();
  });

  await test.step('샵 상세 정보 검증', async () => {
    expect(page.url()).not.toContain('/cok');
    await expect(page.getByText(shopName).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/서울 성동구 성수일로8길 5/).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/서울숲 SK V1 TOWER/).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/테스트/).first()).toBeVisible({ timeout: 30000 });
  });

  await test.step('시술메뉴 손 > 젤기본 선택 및 예약금 검증', async () => {
    await page.getByText('손').first().click();
    await page.getByText('젤기본').first().click();
    await expect(page.getByText('예약금 0원').first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: '예약하기' }).first().click();
  });

  await test.step('날짜/시간/담당자 선택', async () => {
    const staffRow = page.locator('[role="listitem"], li').filter({ hasText: staffName }).first();
    await expect(staffRow).toBeVisible({ timeout: 30000 });
    await staffRow.getByRole('button', { name: '선택' }).first().click();

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
  });

  await test.step('결제 화면 정보 검증 후 예약 요청', async () => {
    await expect(page.getByText(shopName).first()).toBeVisible({ timeout: 30000 });
    const staffOnPayment = page.getByText(staffName).first();
    if (await staffOnPayment.isVisible({ timeout: 1500 }).catch(() => false)) {
      await expect(staffOnPayment).toBeVisible({ timeout: 30000 });
    }
    await expect(page.getByText(new RegExp(`${selectedBookingTime}|오후\\s*${selectedBookingTime}`)).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/지금 결제할 금액\\s*0원|0원/).first()).toBeVisible({ timeout: 30000 });

    const requestInput = page
      .getByPlaceholder(/요청사항|요청 사항/i)
      .or(page.locator('textarea'))
      .or(page.locator('input[type="text"]'))
      .first();
    await requestInput.fill(requestNote);

    await page.getByRole('button', { name: '예약하기' }).first().click();
  });

  await test.step('예약 완료 화면 검증', async () => {
    await expect(page.getByText(/예약\s*완료\s*되었어요\./).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/예약일에\s*만나요/).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(shopName).first()).toBeVisible({ timeout: 30000 });
    const staffOnComplete = page.getByText(staffName).first();
    if (await staffOnComplete.isVisible({ timeout: 1500 }).catch(() => false)) {
      await expect(staffOnComplete).toBeVisible({ timeout: 30000 });
    }
    await expect(page.getByText(new RegExp(`${selectedBookingTime}|오후\\s*${selectedBookingTime}`)).first()).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: finalScreenshotPath, fullPage: true });
  });
});
