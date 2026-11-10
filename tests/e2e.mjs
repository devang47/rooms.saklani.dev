// End-to-end tests in a real browser, against the Firebase emulators, a local
// Cloudflare Pages server and a local signalling server.
//
//   pnpm build:test && pnpm test:e2e
//
// Uses the installed Chrome. Each check logs PASS or FAIL; the run fails if any do.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const REPO = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const BASE = "http://127.0.0.1:4173";
const results = [];
const check = async (name, fn) => {
  try {
    const value = await fn();
    results.push(["PASS", name]);
    console.log("PASS", name, value ?? "");
    return value;
  } catch (e) {
    results.push(["FAIL", name]);
    console.log(
      "FAIL",
      name,
      String(e.message).split("\n").slice(0, 3).join(" | "),
    );
  }
};

const server = spawn(
  "npx",
  ["-y", "wrangler@4", "dev", "--port", "4173", "--ip", "127.0.0.1"],
  {
    cwd: REPO,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    stdio: "ignore",
  },
);
// The P2P signalling server, run locally the way it runs on Cloudflare.
const signalling = spawn(
  "npx",
  [
    "-y",
    "wrangler@4",
    "dev",
    "--port",
    "8788",
    "--ip",
    "127.0.0.1",
    "--var",
    `ALLOWED_ORIGINS:${BASE}`,
  ],
  {
    cwd: `${REPO}/signalling`,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    stdio: "ignore",
  },
);
for (let i = 0; i < 300; i++) {
  try {
    await fetch("http://127.0.0.1:8788/");
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}
for (let i = 0; i < 200; i++) {
  try {
    await fetch(BASE);
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});

const cspErrors = [];
const newUser = async (label) => {
  const context = await browser.newContext({
    permissions: ["camera", "microphone", "clipboard-read", "clipboard-write"],
  });
  // Keep the test away from production analytics and installations.
  await context.route(
    /firebaseinstallations\.googleapis|firebase\.googleapis|google-analytics\.com|google\.com\/g\/collect/,
    (route) => route.abort(),
  );
  // Headless Chrome on macOS hangs on fake audio, so take video from the fake
  // device and add a silent audio track, which is what the adapter expects.
  await context.addInitScript(() => {
    const md = navigator.mediaDevices;
    const real = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => {
      const stream = await real({ video: c.video });
      if (c.audio) {
        const out = new AudioContext().createMediaStreamDestination();
        stream.addTrack(out.stream.getAudioTracks()[0]);
      }
      return stream;
    };
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    const t = m.text();
    if (/content security policy|refused to/i.test(t))
      cspErrors.push(`${label}: ${t}`);
  });
  page.on("pageerror", (e) => console.log(`  [${label} pageerror]`, e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
      console.log(`  [${label} console]`, m.text().slice(0, 300));
  });
  return page;
};

const a = await newUser("a");
const b = await newUser("b");
const send = async (page, text) => {
  await page.fill("textarea#input", text);
  await page.click('[aria-label="send message button"]');
};
const msg = (page, text) => page.locator(".message-item", { hasText: text });

let code;
await check(
  "every kind of page carries a CSP, including the room fallback",
  async () => {
    for (const path of ["/", "/room", "/p2p", "/room/ABCDEF"]) {
      const res = await fetch(`${BASE}${path}`);
      assert.equal(res.status, 200, path);
      assert.match(
        await res.text(),
        /http-equiv="content-security-policy"/i,
        path,
      );
    }
  },
);

await check(
  "pages inline their CSS instead of blocking on a stylesheet",
  async () => {
    for (const path of ["/", "/room", "/p2p"]) {
      const html = await (await fetch(`${BASE}${path}`)).text();
      const blocking = [
        ...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g),
      ].filter(([tag]) => !/disabled/.test(tag));
      assert.equal(
        blocking.length,
        0,
        `${path}: ${blocking.map(([t]) => t).join(" ")}`,
      );
    }
  },
);

await check(
  "unknown pages return a real 404, and hashed files cache for a year",
  async () => {
    assert.equal((await fetch(`${BASE}/nope`)).status, 404);
    const html = await (await fetch(BASE)).text();
    const asset = html.match(/\/_app\/immutable\/[^"]+\.js/)[0];
    const res = await fetch(BASE + asset);
    assert.match(
      res.headers.get("cache-control"),
      /max-age=31536000, immutable/,
    );
  },
);

await check(
  "landing page loads no third parties, and no Firebase until asked",
  async () => {
    const c = await browser.newContext();
    const page = await c.newPage();
    const urls = [];
    page.on("request", (r) => urls.push(r.url()));
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");
    const external = urls.filter((u) => !u.startsWith(BASE));
    assert.deepEqual(external, []);
    const before = urls.length;
    assert.ok(before <= 40, `${before} requests`);
    const fonts = urls.filter((u) => /woff2/.test(u));
    assert.equal(new Set(fonts).size, fonts.length, "font fetched twice");
    // Hovering Create fetches the room page's code.
    await page.getByRole("button", { name: "create a room" }).first().hover();
    await page.waitForLoadState("networkidle");
    assert.ok(urls.length > before, "hover did not preload");
    await c.close();
    return `${before} requests`;
  },
);

await check("the entrance shows content before any JS runs", async () => {
  const c = await browser.newContext({ javaScriptEnabled: false });
  const page = await c.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(800);
  assert.equal(
    await page.locator("h1", { hasText: "ChatRooms" }).isVisible(),
    true,
  );
  assert.equal(
    await page.locator(".content").evaluate((e) => getComputedStyle(e).opacity),
    "1",
  );
  await c.close();
});

await check("phones don't download the floating images", async () => {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await c.newPage();
  const urls = [];
  page.on("request", (r) => urls.push(r.url()));
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  assert.equal(urls.filter((u) => /float-/.test(u)).length, 0);
  assert.equal(urls.filter((u) => /bg-1280/.test(u)).length, 0);
  assert.equal(urls.filter((u) => /bg-640/.test(u)).length, 1);
  await c.close();
});

await check("the floating images follow the mouse", async () => {
  const c = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await c.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(600);
  const at = () =>
    page
      .locator(".moveable-block")
      .nth(1)
      .evaluate((e) => getComputedStyle(e).translate);
  await page.mouse.move(1270, 790);
  await page.waitForTimeout(700);
  const moved = await at();
  assert.match(moved, /^(1[0-9]|20)(\.\d+)?px/, moved);
  await c.close();
});

await check("create a room from the home page", async () => {
  await a.goto(BASE);
  await a.waitForTimeout(1500);
  await a.getByRole("button", { name: "create a room" }).first().click();
  await a.waitForURL(/\/room\/[A-Z0-9]{6}\/?$/, {
    timeout: 15000,
    waitUntil: "commit",
  });
  code = a.url().match(/room\/([A-Z0-9]{6})/)[1];
  await a.waitForSelector("textarea#input");
  return code;
});

await check("sender's message appears on their side", async () => {
  await send(a, "hello from A 👋");
  await msg(a, "hello from A").waitFor({ timeout: 10000 });
  await a.waitForFunction(() =>
    document.querySelector(".message-item.right-aligned"),
  );
});

await check(
  "second user joins by code and decrypts it, shown as the other person",
  async () => {
    await b.goto(`${BASE}/room`);
    await b.waitForTimeout(1200);
    await b.fill(".roomid-input input", code);
    await b.click('[aria-label="Join room"]');
    await b.waitForURL(/\/room\/[A-Z0-9]{6}\/?$/, {
      timeout: 15000,
      waitUntil: "commit",
    });
    await msg(b, "hello from A").waitFor({ timeout: 10000 });
    await b.waitForFunction(() =>
      document.querySelector(".message-item.left-aligned"),
    );
  },
);

await check("a direct room link opens in a fresh browser", async () => {
  const c = await newUser("direct");
  await c.goto(`${BASE}/room/${code}`);
  await msg(c, "hello from A").waitFor({ timeout: 15000 });
  // History shows at once instead of animating in, even after the chat is ready.
  await c.waitForTimeout(300);
  assert.equal(
    await msg(c, "hello from A").evaluate((e) => e.classList.contains("enter")),
    false,
  );
  await c.context().close();
});

await check("the QR code loads on demand and renders", async () => {
  await a.click('[aria-label="view qr code"]');
  await a.waitForFunction(
    () => {
      const canvas = document.querySelector(".modal canvas");
      return canvas && canvas.width > 100;
    },
    null,
    { timeout: 10000 },
  );
  await a.mouse.click(5, 5);
  await a.waitForFunction(() => !document.querySelector(".modal canvas"));
});

await check("links in messages are clickable and open safely", async () => {
  await send(a, "see https://example.com/page now");
  const link = a.locator('.message-item a[href="https://example.com/page"]');
  await link.waitFor({ timeout: 10000 });
  assert.equal(await link.getAttribute("rel"), "noopener noreferrer");
  await b
    .locator('.message-item a[href="https://example.com/page"]')
    .waitFor({ timeout: 10000 });
});

await check("copying a message shows a check, then resets", async () => {
  const button = msg(a, "hello from A").getByRole("button", {
    name: "copy text",
  });
  await button.click();
  assert.equal(await button.getAttribute("data-copied"), "true");
  await a.waitForFunction(
    (el) => !el.hasAttribute("data-copied"),
    await button.elementHandle(),
    { timeout: 3000 },
  );
});

await check(
  "new messages animate in, and the reader isn't yanked down",
  async () => {
    for (let i = 0; i < 14; i++) await send(b, `filler ${i}`);
    await msg(a, "filler 13").waitFor({ timeout: 15000 });
    assert.equal(
      await msg(a, "filler 13").evaluate((e) => e.classList.contains("enter")),
      true,
    );
    // Lets the chat finish following the fillers before the reader scrolls up.
    await a.waitForTimeout(800);
    await a
      .locator(".chat-messages-wrapper")
      .evaluate((e) => e.scrollTo({ top: 0 }));
    await a.waitForTimeout(300);
    await send(b, "while you were away");
    const pill = a.locator(".new-messages");
    await a.waitForFunction(
      () =>
        document.querySelector(".new-messages")?.hasAttribute("data-visible"),
      null,
      { timeout: 10000 },
    );
    assert.equal(
      await a.locator(".chat-messages-wrapper").evaluate((e) => e.scrollTop),
      0,
    );
    await pill.click();
    await a.waitForFunction(
      () => {
        const e = document.querySelector(".chat-messages-wrapper");
        return e.scrollHeight - e.scrollTop - e.clientHeight < 80;
      },
      null,
      { timeout: 5000 },
    );
    await a.waitForFunction(
      () =>
        !document.querySelector(".new-messages").hasAttribute("data-visible"),
    );
    // Your own messages always bring you to the bottom.
    await a
      .locator(".chat-messages-wrapper")
      .evaluate((e) => e.scrollTo({ top: 0 }));
    await send(a, "my own message");
    await a.waitForFunction(
      () => {
        const e = document.querySelector(".chat-messages-wrapper");
        return e.scrollHeight - e.scrollTop - e.clientHeight < 80;
      },
      null,
      { timeout: 5000 },
    );
  },
);

await check("messages show when they were sent", async () => {
  const time = await a.locator(".message-item time").first().innerText();
  assert.match(time, /\d{1,2}:\d{2}/);
});

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

await check("uploaded images show a preview for everyone", async () => {
  await a.setInputFiles("#fileinput", {
    name: "dot.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await a.waitForFunction(
    () => /dot\.png/.test(document.querySelector("textarea#input").value),
    null,
    { timeout: 15000 },
  );
  await a.click('[aria-label="send message button"]');
  for (const page of [a, b]) {
    await page.waitForFunction(
      () => {
        const img = document.querySelector(".message-item img");
        return img && img.complete && img.naturalWidth > 0;
      },
      null,
      { timeout: 15000 },
    );
  }
});

await check(
  "uploading with text already typed keeps it, and the loader clears",
  async () => {
    await a.fill("textarea#input", "my note");
    await a.setInputFiles("#fileinput", {
      name: "a.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("x"),
    });
    await a.waitForFunction(
      () =>
        /^my note http.*a\.txt/.test(
          document.querySelector("textarea#input").value,
        ),
      null,
      { timeout: 15000 },
    );
    await a.waitForFunction(
      () => !document.querySelector("section.fixed.inset-0"),
      null,
      { timeout: 5000 },
    );
    await a.fill("textarea#input", "");
  },
);

await check("pasting a file uploads it", async () => {
  await a.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(new File(["pasted"], "pasted.txt", { type: "text/plain" }));
    document.querySelector("textarea#input").dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await a.waitForFunction(
    () => /pasted\.txt/.test(document.querySelector("textarea#input").value),
    null,
    { timeout: 15000 },
  );
  await a.fill("textarea#input", "");
});

await check("dropping a file uploads it", async () => {
  await a.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(
      new File(["dropped"], "dropped.txt", { type: "text/plain" }),
    );
    const target = document.querySelector("section.chat-ui .container");
    target.dispatchEvent(
      new DragEvent("dragover", {
        dataTransfer: data,
        bubbles: true,
        cancelable: true,
      }),
    );
    target.dispatchEvent(
      new DragEvent("drop", {
        dataTransfer: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await a.waitForFunction(
    () => /dropped\.txt/.test(document.querySelector("textarea#input").value),
    null,
    { timeout: 15000 },
  );
  await a.fill("textarea#input", "");
});

await check("the countdown shows on phones", async () => {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await c.newPage();
  await page.goto(`${BASE}/room/${code}`);
  const timer = page.locator(
    'header [title="Time until this room is deleted"]',
  );
  await timer.waitFor({ timeout: 15000 });
  await page.waitForFunction(
    () =>
      /^1[0-5]:\d{2}$/.test(
        document.querySelector(
          'header [title="Time until this room is deleted"]',
        ).innerText,
      ),
    null,
    { timeout: 15000 },
  );
  assert.equal(await timer.isVisible(), true);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "room scrolls sideways",
  );
  await c.close();
});

await check(
  "rooms warn a minute before expiry, then send people home",
  async () => {
    const { deriveRoom, generateRoomCode } = await import(
      `${REPO}/src/helpers/crypt.ts`
    );
    const expiring = generateRoomCode();
    const { id } = await deriveRoom(expiring);
    const res = await fetch(
      `http://127.0.0.1:8080/v1/projects/demo-rooms/databases/(default)/documents/rooms/${id}`,
      {
        method: "PATCH",
        headers: { Authorization: "Bearer owner" },
        body: JSON.stringify({
          fields: {
            timestamp: {
              integerValue: String(Date.now() - 15 * 60 * 1000 + 20000),
            },
          },
        }),
      },
    );
    assert.equal(res.status, 200);
    const c = await browser.newContext();
    const page = await c.newPage();
    await page.goto(`${BASE}/room/${expiring}`);
    await page
      .getByText("This room is deleted in under a minute")
      .waitFor({ timeout: 10000 });
    assert.match(
      await page
        .locator('header [title="Time until this room is deleted"]')
        .getAttribute("class"),
      /text-red-300/,
    );
    await page.waitForURL(`${BASE}/`, { timeout: 30000, waitUntil: "commit" });
    await page.getByText("This room has expired").waitFor({ timeout: 5000 });
    await c.close();
  },
);

await check("replies arrive live", async () => {
  await send(b, "hi from B");
  await msg(a, "hi from B").waitFor({ timeout: 10000 });
});

await check(
  "the database only holds ciphertext, under a separate ID",
  async () => {
    const url = `http://127.0.0.1:8080/v1/projects/demo-rooms/databases/(default)/documents/rooms`;
    const auth = { headers: { Authorization: "Bearer owner" } };
    const { deriveRoom } = await import(`${REPO}/src/helpers/crypt.ts`);
    const { id } = await deriveRoom(code);
    assert.match(id, /^[a-f0-9]{64}$/);
    assert.ok((await fetch(`${url}/${id}`, auth)).ok);
    const data = await (await fetch(`${url}/${id}/data`, auth)).json();
    assert.ok(data.documents.length >= 2);
    for (const d of data.documents) {
      const stored = d.fields.data.stringValue;
      assert.ok(!Buffer.from(stored, "base64").toString().includes("hello"));
    }
    const first = data.documents.find(
      (d) => d.fields.data.stringValue.length < 80,
    );
    assert.ok(first, "short messages stay short");
  },
);

await check(
  "anonymous listing of rooms is refused for real clients",
  async () => {
    const res = await fetch(
      `http://127.0.0.1:8080/v1/projects/demo-rooms/databases/(default)/documents/rooms`,
    );
    assert.equal(res.status, 403);
  },
);

await check("upload works and puts a link in the input", async () => {
  await a.setInputFiles("#fileinput", {
    name: "note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });
  await a.waitForFunction(
    () => /note\.txt/.test(document.querySelector("textarea#input").value),
    null,
    { timeout: 15000 },
  );
  await a.fill("textarea#input", "");
});

await check("a file over 20 MB is refused with the right message", async () => {
  await a.setInputFiles("#fileinput", {
    name: "big.bin",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(20 * 1024 * 1024 + 1),
  });
  await a.getByText("File size exceeds 20mb limit!").waitFor({ timeout: 8000 });
  await a.waitForFunction(
    () => !document.querySelector("section.fixed.inset-0"),
  );
});

await check("deleting a room sends the user home and removes it", async () => {
  await a.click('[aria-label="delete room"]');
  await a.waitForURL(`${BASE}/`, { timeout: 15000, waitUntil: "commit" });
  await a.waitForTimeout(500);
  const auth = { headers: { Authorization: "Bearer owner" } };
  const rooms = await (
    await fetch(
      `http://127.0.0.1:8080/v1/projects/demo-rooms/databases/(default)/documents/rooms`,
      auth,
    )
  ).json();
  const { deriveRoom } = await import(`${REPO}/src/helpers/crypt.ts`);
  const { id } = await deriveRoom(code);
  assert.ok(!(rooms.documents ?? []).some((d) => d.name.endsWith(id)));
});

// P2P, against the local signalling server.
const startPeer = async (page, path = "/p2p") => {
  await page.goto(`${BASE}${path}`);
  if (path === "/p2p") await page.click('[aria-label="Start server"]');
  const button = page.locator('[aria-label="copy room id"]');
  await button.waitFor({ timeout: 30000 });
  return (await button.innerText()).replace(/\s+/g, "").trim();
};
const prompt = (page, text) => page.getByRole("alertdialog", { name: text });
const answer = async (page, text, button) => {
  const dialog = prompt(page, text);
  await dialog.waitFor({ timeout: 15000 });
  await dialog.getByRole("button", { name: button }).click();
};
const connect = async (page, id) => {
  await page.fill('input[placeholder="Enter ID"]', id);
  await page.getByRole("button", { name: "Connect" }).click();
};
const connectionButton = (page, id) =>
  page.getByRole("button", { name: id, exact: true });

const p1 = await newUser("p1");
const p2 = await newUser("p2");
const p3 = await newUser("p3");
let id1, id2, id3;

await check("peers start quickly with long, valid IDs", async () => {
  const start = Date.now();
  [id1, id2, id3] = await Promise.all([
    startPeer(p1),
    startPeer(p2),
    startPeer(p3),
  ]);
  for (const id of [id1, id2, id3])
    assert.match(id, /^[a-z]+-[a-z]+-[a-z0-9]+$/);
  return `${Date.now() - start}ms for three`;
});

await check("the P2P page fits a phone screen once started", async () => {
  const c = await browser.newContext({
    viewport: { width: 360, height: 780 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await c.newPage();
  await startPeer(page);
  await page.waitForTimeout(300);
  const widths = await page.evaluate(() => [
    document.body.scrollWidth,
    innerWidth,
  ]);
  assert.ok(
    widths[0] <= widths[1],
    `body ${widths[0]} > viewport ${widths[1]}`,
  );
  await c.close();
});

await check("connecting to an unknown ID fails at once", async () => {
  const start = Date.now();
  await connect(p3, "nobody-here-1");
  await p3
    .getByText("Could not connect to peer nobody-here-1")
    .first()
    .waitFor({ timeout: 5000 });
  return `${Date.now() - start}ms`;
});

await check("declined peers are not connected", async () => {
  await connect(p3, id1);
  await answer(p1, `${id3} wants to connect`, "Decline");
  await p1.waitForTimeout(1500);
  assert.equal(await connectionButton(p1, id3).count(), 0);
});

await check(
  "accepted peers connect after an inline prompt naming them",
  async () => {
    await connect(p2, id1);
    await answer(p1, `${id2} wants to connect`, "Accept");
    await connectionButton(p1, id2).waitFor({ timeout: 15000 });
    await connectionButton(p2, id1).waitFor({ timeout: 15000 });
  },
);

await check(
  "P2P messages flow both ways, without a loader or toast",
  async () => {
    await p2.fill("textarea#input", "p2 says hi");
    await p2.getByRole("button", { name: "send message button" }).click();
    assert.equal(await p2.locator("section.fixed.inset-0").count(), 0);
    await msg(p1, "p2 says hi").waitFor({ timeout: 15000 });
    await p1.fill("textarea#input", "p1 replies");
    await p1.keyboard.press("Enter");
    await msg(p2, "p1 replies").waitFor({ timeout: 15000 });
    assert.equal(await p2.getByText("Message sent successfully").count(), 0);
  },
);

const card = (page, name) => page.getByRole("group", { name: `File ${name}` });

await check("files show as cards, ask first, and arrive intact", async () => {
  const payload = Buffer.alloc(300 * 1024, 7);
  payload.write("start");
  await p2.setInputFiles("#fileinput", {
    name: "big.bin",
    mimeType: "application/octet-stream",
    buffer: payload,
  });
  await card(p2, "big.bin")
    .getByText("Waiting for them to accept")
    .waitFor({ timeout: 10000 });
  await card(p1, "big.bin")
    .getByText("Wants to send you this file")
    .waitFor({ timeout: 10000 });
  const download = p1.waitForEvent("download", { timeout: 20000 });
  await card(p1, "big.bin").getByRole("button", { name: "Accept" }).click();
  const file = await download;
  assert.equal(file.suggestedFilename(), "big.bin");
  const { readFileSync } = await import("node:fs");
  assert.ok(readFileSync(await file.path()).equals(payload), "content differs");
  await card(p1, "big.bin").getByText("Received").waitFor({ timeout: 10000 });
  await card(p2, "big.bin").getByText("Sent").waitFor({ timeout: 10000 });
});

await check("declined files are never sent", async () => {
  await p2.setInputFiles("#fileinput", {
    name: "no.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("no"),
  });
  await card(p1, "no.txt").getByRole("button", { name: "Decline" }).click();
  await card(p2, "no.txt").getByText("Declined").waitFor({ timeout: 10000 });
});

await check("an invite link connects straight away", async () => {
  const p4 = await newUser("p4");
  await p4.goto(`${BASE}/p2p?connect=${id1}`);
  await answer(p1, "wants to connect", "Accept");
  await connectionButton(p4, id1).waitFor({ timeout: 20000 });
  assert.equal(new URL(p4.url()).search, "");
  await p4.context().close();
});

await check("the invite shows a QR code and link", async () => {
  await p1.getByRole("button", { name: "Invite" }).click();
  await p1.waitForFunction(
    () => document.querySelector(".modal canvas")?.width > 100,
    null,
    { timeout: 10000 },
  );
  await p1.getByRole("button", { name: "Copy invite link" }).click();
  const copied = await p1.evaluate(() => navigator.clipboard.readText());
  assert.equal(copied, `${new URL(p1.url()).origin}/p2p?connect=${id1}`);
  await p1.mouse.click(5, 5);
});

await check(
  "video calls ask inline, connect, and have working controls",
  async () => {
    await connectionButton(p1, id2).click();
    await p2.getByRole("button", { name: "Start a video call" }).click();
    await answer(p1, `${id2} is calling`, "Answer");
    for (const page of [p1, p2]) {
      await page.waitForFunction(
        () => document.querySelectorAll("video")[1]?.srcObject != null,
        null,
        { timeout: 20000 },
      );
    }
    assert.equal(await p1.locator("video[playsinline]").count(), 2);

    await p1.getByRole("button", { name: "Mute" }).click();
    await p1.getByRole("button", { name: "Unmute" }).waitFor();
    assert.equal(
      await p1.evaluate(
        () =>
          document.querySelector("video").srcObject.getAudioTracks()[0].enabled,
      ),
      false,
    );
    await p1.getByRole("button", { name: "Camera off" }).click();
    assert.equal(
      await p1.evaluate(
        () =>
          document.querySelector("video").srcObject.getVideoTracks()[0].enabled,
      ),
      false,
    );

    // Clicking outside the call used to hang up.
    await p1.mouse.click(5, 5);
    await p1.waitForTimeout(500);
    assert.equal(
      await p1.getByRole("dialog", { name: "Video call" }).isVisible(),
      true,
    );
  },
);

await check(
  "hanging up on the answering side ends the call for both",
  async () => {
    await p1.getByRole("button", { name: "End call" }).click();
    for (const page of [p1, p2]) {
      await page.waitForFunction(
        () => document.querySelectorAll("video")[0]?.srcObject == null,
        null,
        { timeout: 10000 },
      );
      await page
        .getByRole("dialog", { name: "Video call" })
        .waitFor({ state: "hidden", timeout: 2000 });
    }
  },
);

await check("no CSP violations on any page or flow", async () => {
  await a.goto(`${BASE}/room`);
  await a.goto(BASE);
  await a.waitForTimeout(1500);
  assert.equal(cspErrors.length, 0, [...new Set(cspErrors)].join("\n"));
});

await browser.close();
server.kill();
signalling.kill();
const failed = results.filter(([s]) => s === "FAIL");
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
