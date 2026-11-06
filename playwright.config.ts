import { defineConfig, devices } from "@playwright/test";

// Everything runs locally. `pnpm test:e2e` wraps this in `firebase emulators:exec`, which
// owns the emulator lifecycle (their Java process outlives Playwright's own teardown).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:5174",
    permissions: ["camera", "microphone"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    },
  },
  webServer: [
    {
      command: "npx -y peer@1 --port 9000",
      url: "http://localhost:9000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: "vite dev --mode emulators --port 5174 --strictPort",
      url: "http://localhost:5174",
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
