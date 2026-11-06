import { test, expect, type Browser, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const startPeer = async (browser: Browser) => {
  // Manually created contexts don't inherit `use.permissions` from the config.
  const context = await browser.newContext({
    permissions: ["camera", "microphone"],
  });
  // Headless Chromium's fake *audio* capture hangs on macOS: keep the fake camera and
  // synthesize the mic track with Web Audio instead.
  await context.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original({ video: constraints?.video ?? false });
      if (constraints?.audio) {
        const audio = new AudioContext();
        const dest = audio.createMediaStreamDestination();
        audio.createOscillator().connect(dest);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      }
      return stream;
    };
  });
  const page = await context.newPage();
  await page.goto("/p2p");
  await page.getByRole("button", { name: "Start server" }).click();
  const idButton = page.getByRole("button", { name: "copy room id" });
  await expect(idButton).toHaveText(/^\s*[a-z_-]+-[a-z0-9]{4}\s*$/);
  return { page, id: (await idButton.textContent())!.trim() };
};

const connect = async (from: Page, toId: string) => {
  await from.getByPlaceholder("Enter ID").fill(toId);
  await from.getByRole("button", { name: "Connect" }).click();
};

const answer = (page: Page, text: string, choice: "Accept" | "Decline") =>
  page
    .getByRole("dialog")
    .filter({ hasText: text })
    .getByRole("button", { name: choice })
    .click();

test("p2p: connect with consent, chat, send a file, video call", async ({
  browser,
}) => {
  const a = await startPeer(browser);
  const b = await startPeer(browser);

  await connect(b.page, a.id);
  await answer(a.page, `${b.id} wants to connect`, "Accept");
  await expect(a.page.getByRole("button", { name: b.id })).toBeVisible();
  await expect(b.page.getByRole("button", { name: a.id })).toBeVisible();

  // Chat
  await b.page.locator("#input").fill("ping");
  await b.page.locator("#input").press("Enter");
  await expect(a.page.locator(".message-item.left-aligned")).toContainText(
    "ping",
  );
  await expect(b.page.locator(".message-item.right-aligned")).toContainText(
    "ping",
  );

  // File shows up as a download link with the right bytes.
  await a.page.locator('input[type="file"]').setInputFiles({
    name: "note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello file"),
  });
  const link = b.page.getByRole("link", { name: /note\.txt/ });
  const [download] = await Promise.all([
    b.page.waitForEvent("download"),
    link.click(),
  ]);
  expect(await readFile((await download.path())!, "utf8")).toBe("hello file");

  // Video call: callee must accept, both sides get a remote stream, hang-up closes both.
  await b.page.getByRole("button", { name: "Start a video call" }).click();
  await answer(a.page, `${b.id} is calling you`, "Accept");
  for (const { page } of [a, b]) {
    await expect(
      page.getByRole("dialog", { name: "Video call" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              (document.querySelectorAll("video")[1] as HTMLVideoElement)
                .srcObject as MediaStream | null
            )?.getTracks().length ?? 0,
        ),
      )
      .toBeGreaterThan(0);
  }
  await a.page.getByRole("button", { name: "End Call" }).click();
  await expect(b.page.getByRole("dialog", { name: "Video call" })).toBeHidden();

  // Stopping one side removes it from the other's list.
  await a.page.getByRole("button", { name: "toggle peerjs server" }).click();
  await expect(b.page.getByRole("button", { name: a.id })).toBeHidden();
});

test("p2p: a declined connection is reported to the caller", async ({
  browser,
}) => {
  const a = await startPeer(browser);
  const c = await startPeer(browser);

  await connect(c.page, a.id);
  await answer(a.page, `${c.id} wants to connect`, "Decline");
  await expect(
    c.page.getByText(`${a.id} declined the connection`),
  ).toBeVisible();
  await expect(a.page.getByRole("button", { name: c.id })).toBeHidden();
});
