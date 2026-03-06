const { test, expect } = require("@playwright/test");
const { classifyTicket } = require("../src/aiClassifier");

test("login success + AI ticket classification", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("Username").fill("standard_user");
  await page.getByPlaceholder("Password").fill("secret_sauce");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/inventory.html/);
  await expect(page.getByText("Products")).toBeVisible();

  const ticket = "로그인 후 결제가 실패하고 payment error 가 발생합니다.";
  const category = classifyTicket(ticket);
  expect(category).toBe("billing");
});
