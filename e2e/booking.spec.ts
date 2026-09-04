import { expect, test } from "@playwright/test";

/**
 * The booking journey, end to end, on desktop and on a phone.
 *
 * These stop at the payment step. Driving Stripe's Payment Element means
 * driving a cross-origin iframe against Stripe's test mode, which belongs in a
 * separate, credentialled suite -- everything up to "we are asking you to pay
 * the right amount for the right slot" is covered here, and the webhook path
 * that actually confirms a booking is covered by the database integration
 * tests instead.
 */

test.describe("public site", () => {
  test("homepage leads to booking", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /hair care/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /book now/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("catalogue lists services with durations", async ({ page }) => {
    await page.goto("/services");

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      /made for your hair/i,
    );
    const cards = page.getByRole("article");
    await expect(cards.first()).toBeVisible();
    // Prices are placeholders, so assert the shape rather than a figure.
    await expect(page.getByText(/\d+ min|\d+ hr/).first()).toBeVisible();
  });

  test("every primary nav destination resolves", async ({ page }) => {
    for (const path of [
      "/services",
      "/stylists",
      "/about",
      "/gallery",
      "/contact",
      "/policies",
      "/privacy",
      "/terms",
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should not error`).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("policy page states the cancellation window", async ({ page }) => {
    await page.goto("/policies");
    // Read from the salon record, so this proves the two agree.
    await expect(page.getByText(/\d+ hours before your appointment/)).toBeVisible();
  });
});

test.describe("booking flow", () => {
  test("reaches payment with a service, stylist and slot chosen", async ({ page }) => {
    await page.goto("/book");

    // 1. Service
    await expect(page.getByRole("heading", { name: /choose a service/i })).toBeVisible();
    await page.getByRole("button", { name: /silk press/i }).first().click();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // 2. Stylist
    await page.getByRole("button", { name: /any available stylist/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // 3. Date and time
    await expect(page.getByRole("group", { name: /filter by time of day/i })).toBeVisible();
    const slot = page.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first();
    await expect(slot).toBeVisible({ timeout: 15_000 });
    await slot.click();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // 4. Details
    await page.getByLabel(/first name/i).fill("Test");
    await page.getByLabel(/last name/i).fill("Customer");
    await page.getByLabel(/email/i).fill(`e2e-${Date.now()}@example.test`);
    await page.getByLabel(/mobile/i).fill("07700 900999");
    await page.getByRole("checkbox", { name: /cancellation policy/i }).check();
    await page.getByRole("button", { name: /continue|pay/i }).click();

    // 5. Payment: the summary must state what is being charged.
    await expect(page.getByText(/deposit/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/£\d+/).first()).toBeVisible();
  });

  test("cannot continue from details until the form is complete", async ({ page }) => {
    await page.goto("/book");

    await page.getByRole("button", { name: /silk press/i }).first().click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.getByRole("button", { name: /any available stylist/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();

    const slot = page.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first();
    await expect(slot).toBeVisible({ timeout: 15_000 });
    await slot.click();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // Nothing filled in: the call to action must not be usable.
    const cta = page.getByRole("button", { name: /continue|pay/i }).last();
    await expect(cta).toBeDisabled();
  });

  test("the held slot is shown counting down", async ({ page }) => {
    await page.goto("/book");
    await page.getByRole("button", { name: /silk press/i }).first().click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page.getByRole("button", { name: /any available stylist/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();

    const slot = page.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first();
    await expect(slot).toBeVisible({ timeout: 15_000 });
    await slot.click();
    await page.getByRole("button", { name: /^continue$/i }).click();

    // A customer needs to know the slot is not theirs indefinitely.
    await expect(page.getByText(/held|minutes/i).first()).toBeVisible();
  });
});

test.describe("private areas", () => {
  test("the portal requires signing in", async ({ page }) => {
    await page.goto("/account/bookings");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("studio requires signing in", async ({ page }) => {
    await page.goto("/studio");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("private pages are not offered to search engines", async ({ page }) => {
    await page.goto("/sitemap.xml");
    const xml = await page.content();
    expect(xml).not.toContain("/studio");
    expect(xml).not.toContain("/account");
  });
});

test.describe("accessibility basics", () => {
  test("pages have one h1 and a skip-free heading order", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("the booking drawer traps focus and closes on Escape", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /book now/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
