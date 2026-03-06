const { test, expect } = require('@playwright/test');

async function loginWithKakao(page, context) {
  const kakaoId = process.env.KAKAO_ID || 'developer@herren.co.kr';
  const kakaoPassword = process.env.KAKAO_PASSWORD || 'herren3378!';

  await page.goto('https://qa-zero.gongbiz.kr/', { waitUntil: 'domcontentloaded' });

  const myMenu = page.getByRole('link', { name: '마이' }).or(page.getByRole('button', { name: '마이' })).first();
  await expect(myMenu).toBeVisible();
  await myMenu.click();

  const loginEntry = page.getByRole('link', { name: '로그인 / 회원가입' }).first();
  await expect(loginEntry).toBeVisible();
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
}

test('qa-zero 내주변 탭에서 네이버 지도 로드 확인(탐색)', async ({ page, context }) => {
  test.setTimeout(180000);

  await loginWithKakao(page, context);

  const nearbyTab = page.getByRole('link', { name: '내주변' }).or(page.getByRole('button', { name: '내주변' })).first();
  await expect(nearbyTab).toBeVisible({ timeout: 30000 });
  await nearbyTab.click();

  // 위치 권한 관련 UI가 뜨면 닫고 진행
  const dismissLocationUi = page
    .getByRole('button', { name: /닫기|나중에|취소|다음에|허용 안 함|허용안함/i })
    .or(page.getByRole('link', { name: /닫기|나중에|취소|다음에/i }))
    .first();
  if (await dismissLocationUi.isVisible({ timeout: 3000 }).catch(() => false)) {
    await dismissLocationUi.click().catch(() => {});
  }

  await page.waitForTimeout(3000);

  const naverMapResources = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource');
    return entries
      .map((entry) => entry.name)
      .filter((url) => /naver\.com|naverapis\.com/i.test(url));
  });

  console.log('Naver-related resources:', naverMapResources.slice(0, 10));
  expect(naverMapResources.length).toBeGreaterThan(0);
});
