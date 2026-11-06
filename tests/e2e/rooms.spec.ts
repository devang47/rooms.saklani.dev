import { test, expect } from "@playwright/test";

test("rooms: create, chat across two browsers, delete", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  a.on("console", (m) => console.log("[A]", m.type(), m.text().slice(0, 300)));
  a.on("pageerror", (e) => console.log("[A] pageerror", e.message));
  const b = await (await browser.newContext()).newPage();

  await a.goto("/");
  await a.getByRole("button", { name: "create a room" }).click();
  await a.waitForURL(/\/room\/[A-Z0-9]{6}$/);

  // Enter sends; own messages are right-aligned.
  await a.locator("#input").fill("hello from A");
  await a.locator("#input").press("Enter");
  await expect(a.locator(".message-item.right-aligned")).toContainText(
    "hello from A",
  );

  // Second browser decrypts it with the code from the URL.
  await b.goto(a.url());
  await expect(b.locator(".message-item.left-aligned")).toContainText(
    "hello from A",
  );

  // Shift+Enter inserts a newline instead of sending.
  const input = b.locator("#input");
  await input.fill("line 1");
  await input.press("Shift+Enter");
  await input.pressSequentially("line 2");
  await expect(input).toHaveValue("line 1\nline 2");
  await input.press("Enter");
  await expect(a.locator(".message-item.left-aligned")).toContainText("line 2");

  // Deleting sends both browsers home.
  await a.getByRole("button", { name: "delete room" }).click();
  await a.waitForURL("/");
  await b.waitForURL("/");
  await expect(
    b.getByText("This room has expired or was deleted"),
  ).toBeVisible();
});

test("rooms: joining an unknown code shows not found", async ({ page }) => {
  await page.goto("/room");
  await page.getByPlaceholder("xxxxxx").fill("ZZZZZ9");
  await page.getByRole("button", { name: "Join room" }).click();
  await expect(page.getByText("404 Not found!")).toBeVisible();
});
