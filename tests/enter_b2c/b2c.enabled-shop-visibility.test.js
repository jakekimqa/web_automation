const { test, expect } = require('@playwright/test');

const B2C_URL = 'https://qa-zero.gongbiz.kr/';
const TARGET_SHOP_NAME = process.env.B2C_TARGET_SHOP_NAME || '최초 샵 테스트';

// Test Case: B2C 내주변 목록에서 활성화된 샵 노출 및 상세 진입 검증
// 시나리오:
// 1) B2C 메인 진입 (비로그인)
// 2) 위치 권한/초기 팝업이 보이면 닫기
// 3) 하단 바텀시트 "내주변"에서 [목록보기] 클릭
// 4) 하단 리스트를 스크롤하며 대상 샵명 탐색
// 5) 리스트에서 대상 샵 노출 확인 후 샵 상세 진입
// 6) 샵 상세 화면에서 샵명 일치 검증

test.use({
  geolocation: { latitude: 37.5446, longitude: 127.0562 },
  permissions: ['geolocation']
});

async function dismissLocationPopupIfPresent(page) {
  const dismissButton = page
    .getByRole('button', { name: /닫기|나중에|취소|다음에|허용 안 함|허용안함/i })
    .or(page.getByRole('link', { name: /닫기|나중에|취소|다음에/i }))
    .first();

  if (await dismissButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dismissButton.click().catch(() => {});
  }
}

async function openNearbyList(page) {
  const nearbyTab = page
    .getByRole('link', { name: '내주변' })
    .or(page.getByRole('button', { name: '내주변' }))
    .or(page.getByText('내주변'))
    .first();
  await expect(nearbyTab).toBeVisible({ timeout: 30000 });
  await nearbyTab.click();

  await dismissLocationPopupIfPresent(page);

  const listButton = page.getByRole('button', { name: '목록보기' }).first();
  await expect(listButton).toBeVisible({ timeout: 20000 });
  await listButton.click();
}

async function nudgeBottomListScroll(page) {
  const listPanel = page.locator('div.flex.min-h-0.flex-1.flex-col').first();
  if (await listPanel.isVisible({ timeout: 3000 }).catch(() => false)) {
    await listPanel.evaluate((el) => {
      el.scrollBy(0, 700);
    });
    await page.waitForTimeout(250);
    return;
  }

  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(250);
}

async function findShopInBottomList(page, shopName) {
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

    const listPanel = page.locator('div.flex.min-h-0.flex-1.flex-col').first();
    if (await listPanel.isVisible().catch(() => false)) {
      await listPanel.evaluate((el) => {
        el.scrollBy(0, 950);
      });
    } else {
      await page.mouse.wheel(0, 1100);
    }

    await page.waitForTimeout(250);
  }

  return false;
}

async function enterShopDetail(page, shopName) {
  for (let i = 0; i < 4; i += 1) {
    if (page.url().includes('/cok')) {
      const nearbyTab = page.getByRole('link', { name: '내주변' }).first();
      if (await nearbyTab.isVisible().catch(() => false)) {
        await nearbyTab.click();
        await page.getByRole('button', { name: '목록보기' }).first().click();
        await findShopInBottomList(page, shopName);
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

test('b2c 활성화 샵 목록 노출 및 상세 진입 확인', async ({ page }) => {
  test.setTimeout(180000);
  const detailScreenshotPath =
    process.env.B2C_DETAIL_SCREENSHOT_PATH || 'test-results/b2c-enabled-shop-detail.png';

  await page.goto(B2C_URL, { waitUntil: 'domcontentloaded' });

  await test.step('내주변 목록 진입', async () => {
    await openNearbyList(page);
    await nudgeBottomListScroll(page);
  });

  await test.step('목록에서 대상 샵 탐색', async () => {
    const found = await findShopInBottomList(page, TARGET_SHOP_NAME);
    expect(found, `목록에서 "${TARGET_SHOP_NAME}" 샵을 찾지 못했습니다.`).toBeTruthy();
  });

  await test.step('샵 상세 진입 및 샵명 검증', async () => {
    const entered = await enterShopDetail(page, TARGET_SHOP_NAME);
    expect(entered, `"${TARGET_SHOP_NAME}" 샵 상세 진입 클릭에 실패했습니다.`).toBeTruthy();

    expect(page.url()).not.toContain('/cok');
    await expect(page.getByRole('button', { name: '예약하기' }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(TARGET_SHOP_NAME).first()).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: detailScreenshotPath, fullPage: true });
  });
});
