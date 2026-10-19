// Builds for the E2E tests. The guides' lists are searched in the stand-in for the API
// (e2e/fake-rakuten-api.ts), started for the build alone on a free port, so that no build calls
// the API and the guides are prerendered with items. The Rakuten keys are stand-ins. Run by Node,
// which strips the types.
import { spawn } from "node:child_process";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { FAKE_RAKUTEN_API_PORT, fakeRakutenApi } from "../e2e/fake-rakuten-api.ts";

const api = fakeRakutenApi().listen(0, "127.0.0.1");
await once(api, "listening");
const { port } = api.address() as AddressInfo;

const build = spawn("pnpm", ["build"], {
  cwd: join(import.meta.dirname, ".."),
  stdio: "inherit",
  env: {
    ...process.env,
    GUIDE_ITEMS_ENDPOINT: `http://127.0.0.1:${port}/search`,
    // The item lookup is tested against the stand-in the tests start (playwright.config.ts).
    ITEM_LOOKUP_ENDPOINT: `http://127.0.0.1:${FAKE_RAKUTEN_API_PORT}/search`,
    RAKUTEN_APPLICATION_ID: "e2e-application-id",
    RAKUTEN_ACCESS_KEY: "e2e-access-key",
    RAKUTEN_AFFILIATE_ID: "e2e-affiliate-id",
  },
});
const [code] = await once(build, "exit");
api.close();
process.exit(code ?? 1);
