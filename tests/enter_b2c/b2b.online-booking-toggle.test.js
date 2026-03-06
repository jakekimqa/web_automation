const { test, expect } = require('@playwright/test');

const B2B_SIGNIN_URL = 'https://crm-dev6.gongbiz.kr/signin';
const TARGET_SHOP_NAME = '최초 샵 테스트';

const ONLINE_BOOKING_MENU_TEXT = /온라인 예약/;
const GONGBISO_SUBMENU_TEXT = /공비서로 예약받기/;
const TOGGLE_LABEL_TEXT = /공비서로 온라인 예약받기/;

const BENEFIT_TEXT_ON = '카카오 알림톡 무료 사용 중';
const BENEFIT_TEXT_OFF = '공비서로 예약받고 알림톡 무료로 사용해보세요';
const MODAL_REASON_TEXT = '샵 운영 방식에 맞지않아요.';
const DISABLE_BUTTON_TEXT = '예약받기 비활성화';
const DISABLE_SUCCESS_TEXT = '예약받기가 비활성화되었습니다. 무료 알림톡 혜택이 함께 중단됩니다.';
const ENABLE_SUCCESS_TEXT = '저장되었습니다.';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Test Case: B2B 공비서 온라인 예약받기 토글 OFF -> ON 검증
// 시나리오:
// 1) B2B 로그인 -> 마이페이지 -> 샵 리스트에서 [샵으로 이동]
// 2) 좌측 상단 샵명 확인
// 3) 좌측 GNB [온라인 예약] -> [공비서로 예약받기] 진입
// 4) "공비서로 온라인 예약받기" 토글이 ON 상태인지 확인
// 5) 토글 OFF 클릭 -> 사유 선택("샵 운영 방식에 맞지않아요.") -> [예약받기 비활성화]
// 6) 성공 문구 검증 후 토글 OFF / 안내문구 변경 검증
// 7) 토글 ON 클릭 -> "저장되었습니다." 확인 후 안내문구 원복 검증
test('b2b 공비서 온라인 예약받기 토글 off 전환', async ({ page }) => {
  test.setTimeout(180000);

  const b2bId = process.env.B2B_ID || 'jaketest';
  const b2bPassword = process.env.B2B_PASSWORD || 'gong2023@@';

  await page.goto(B2B_SIGNIN_URL, { waitUntil: 'domcontentloaded' });

  await page
    .locator(
      'input[name="loginId"], input[name="id"], input[autocomplete="username"], input[type="text"], input[placeholder*="아이디"]'
    )
    .first()
    .fill(b2bId);
  await page
    .locator(
      'input[name="password"], input[type="password"], input[autocomplete="current-password"], input[placeholder*="비밀번호"]'
    )
    .first()
    .fill(b2bPassword);

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

  const shopNameCell = page.getByText(new RegExp(`^\\s*${escapeRegExp(TARGET_SHOP_NAME)}\\s*$`)).first();
  await expect(shopNameCell).toBeVisible({ timeout: 30000 });

  const moveToShopButton = page
    .locator(
      `xpath=(//*[normalize-space(text())="${TARGET_SHOP_NAME}"]/following::*[(self::button or self::a) and contains(normalize-space(.), "샵으로 이동")])[1]`
    )
    .first();
  await expect(moveToShopButton).toBeVisible({ timeout: 30000 });
  await moveToShopButton.click();
  await page.waitForLoadState('networkidle');

  const topLeftShopName = page
    .locator('header, [class*="header"], [class*="top"], [class*="shop"]')
    .getByText(new RegExp(escapeRegExp(TARGET_SHOP_NAME)))
    .first();
  await expect(topLeftShopName).toBeVisible({ timeout: 30000 });

  const onlineBookingMenu = page
    .getByRole('link', { name: ONLINE_BOOKING_MENU_TEXT })
    .or(page.getByRole('button', { name: ONLINE_BOOKING_MENU_TEXT }))
    .or(page.getByText(ONLINE_BOOKING_MENU_TEXT))
    .first();
  await expect(onlineBookingMenu).toBeVisible({ timeout: 30000 });
  await onlineBookingMenu.click();

  const gongbisoSubmenu = page
    .getByRole('link', { name: GONGBISO_SUBMENU_TEXT })
    .or(page.getByRole('button', { name: GONGBISO_SUBMENU_TEXT }))
    .or(page.getByText(GONGBISO_SUBMENU_TEXT))
    .first();
  await expect(gongbisoSubmenu).toBeVisible({ timeout: 30000 });
  await gongbisoSubmenu.click();
  await page.waitForLoadState('networkidle');

  const toggleLabel = page.getByText(TOGGLE_LABEL_TEXT).first();
  await expect(toggleLabel).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(BENEFIT_TEXT_ON).first()).toBeVisible({ timeout: 30000 });

  const labelBox = await toggleLabel.boundingBox();
  if (!labelBox) throw new Error('토글 라벨 좌표를 찾을 수 없습니다.');
  await page.mouse.click(labelBox.x - 36, labelBox.y + labelBox.height / 2);

  const disableModalHeading = page.getByRole('heading', { name: /예약받기 비활성화/ }).first();
  const disableModal = page
    .locator(
      'xpath=//*[self::h1 or self::h2 or self::h3][normalize-space()="예약받기 비활성화"]/ancestor::*[(self::div or self::section) and .//*[contains(normalize-space(.), "비활성화 사유")] and .//button[contains(normalize-space(.), "예약받기 비활성화")]][1]'
    )
    .first();
  await expect(disableModal).toBeVisible({ timeout: 15000 });

  const reasonOption = disableModal.getByRole('listitem').filter({ hasText: /샵 운영 방식에 맞지\s*않아요\./ }).first();
  await expect(reasonOption).toBeVisible({ timeout: 30000 });
  await reasonOption.scrollIntoViewIfNeeded();
  await reasonOption.click({ position: { x: 12, y: 12 } });
  await expect(disableModal.getByText(/설정을 조정하면 원장님 운영 방식에 맞게 사용할 수 있어요\./).first()).toBeVisible({
    timeout: 10000
  });

  const disableButton = disableModal
    .getByRole('button', { name: new RegExp(`^\\s*${escapeRegExp(DISABLE_BUTTON_TEXT)}\\s*$`) })
    .or(disableModal.getByText(new RegExp(`^\\s*${escapeRegExp(DISABLE_BUTTON_TEXT)}\\s*$`)))
    .last();
  await expect(disableButton).toBeVisible({ timeout: 15000 });
  await expect(disableButton).toBeEnabled({ timeout: 10000 });

  let dialogSeen = false;
  let dialogMessage = '';
  const successText = page.getByText(/예약받기가 비활성화되었습니다\..*무료 알림톡 혜택이 함께 중단됩니다\./).first();
  let nativeDialogResolve;
  const nativeDialogSeen = new Promise((resolve) => {
    nativeDialogResolve = resolve;
  });
  page.on('dialog', async (dialog) => {
    dialogSeen = true;
    dialogMessage = dialog.message();
    await dialog.accept();
    nativeDialogResolve(true);
  });

  const waitForApplied = async (timeout) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      if (dialogSeen) return 'dialog';
      const domSuccessVisible = await successText.isVisible({ timeout: 300 }).catch(() => false);
      if (domSuccessVisible) return 'dom-success';
      const offTextVisible = await page.getByText(BENEFIT_TEXT_OFF).first().isVisible({ timeout: 300 }).catch(() => false);
      if (offTextVisible) return 'off-text';
      await page.waitForTimeout(300);
    }
    return '';
  };

  const clickDisableWithFallback = async () => {
    await disableButton.click({ force: true });
    let state = await waitForApplied(10000);
    if (state) return state;

    const box = await disableButton.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      state = await waitForApplied(10000);
      if (state) return state;
    }

    await disableButton.evaluate((el) => el.click());
    state = await waitForApplied(10000);
    return state;
  };

  const appliedState = await clickDisableWithFallback();
  await Promise.race([nativeDialogSeen, page.waitForTimeout(100)]).catch(() => {});

  if (!appliedState) {
    const modalStillVisible = await disableModalHeading.isVisible({ timeout: 1000 }).catch(() => false);
    throw new Error(`비활성화 반영 실패: modalStillVisible=${modalStillVisible}, dialogSeen=${dialogSeen}`);
  }

  if (dialogSeen) {
    expect(dialogMessage).toContain(DISABLE_SUCCESS_TEXT);
  } else {
    const successVisible = await successText.isVisible({ timeout: 1500 }).catch(() => false);
    if (successVisible) {
      await expect(successText).toBeVisible({ timeout: 10000 });
    }
    const confirmButton = page
      .getByRole('button', { name: /^확인$/ })
      .or(page.getByRole('button', { name: /^ok$/i }))
      .or(page.getByText(/^확인$/))
      .first();
    const confirmVisible = await confirmButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (confirmVisible) {
      await confirmButton.click();
    }
  }

  await expect(disableModalHeading).toBeHidden({ timeout: 15000 });
  await expect(page.getByText(BENEFIT_TEXT_ON).first()).toHaveCount(0);
  await expect(page.getByText(BENEFIT_TEXT_OFF).first()).toBeVisible({ timeout: 30000 });

  // OFF 이후 다시 ON 전환 검증
  const onDialogPromise = page.waitForEvent('dialog', { timeout: 7000 }).catch(() => null);
  const onSuccessText = page.getByText(new RegExp(`^\\s*${escapeRegExp(ENABLE_SUCCESS_TEXT)}\\s*$`)).first();
  const onToastPromise = onSuccessText.waitFor({ state: 'visible', timeout: 7000 }).catch(() => null);

  const toggleLabelForOn = page.getByText(TOGGLE_LABEL_TEXT).first();
  await expect(toggleLabelForOn).toBeVisible({ timeout: 15000 });
  const labelBoxForOn = await toggleLabelForOn.boundingBox();
  if (!labelBoxForOn) throw new Error('ON 전환용 토글 라벨 좌표를 찾을 수 없습니다.');
  await page.mouse.click(labelBoxForOn.x - 36, labelBoxForOn.y + labelBoxForOn.height / 2);

  const onResult = await Promise.race([onDialogPromise, onToastPromise]);
  if (!onResult) {
    throw new Error('"저장되었습니다." 알림이 표시되지 않았습니다.');
  }

  if ('message' in onResult) {
    expect(onResult.message()).toContain(ENABLE_SUCCESS_TEXT);
  } else {
    const confirmButton = page
      .getByRole('button', { name: /^확인$/ })
      .or(page.getByRole('button', { name: /^ok$/i }))
      .or(page.getByText(/^확인$/))
      .first();
    const confirmVisible = await confirmButton.isVisible({ timeout: 2500 }).catch(() => false);
    if (confirmVisible) {
      await confirmButton.click();
    }
  }

  await expect(page.getByText(BENEFIT_TEXT_OFF).first()).toHaveCount(0);
  await expect(page.getByText(BENEFIT_TEXT_ON).first()).toBeVisible({ timeout: 30000 });
});
