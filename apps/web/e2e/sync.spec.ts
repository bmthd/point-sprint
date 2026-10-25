import type { CDPSession } from "@playwright/test";
import { type Page, expect, standIn, test } from "./fixtures";
import { PlanPage, ProfilePage, SyncSection, TopPage } from "./pages";

// Two devices, each a browser context with a virtual authenticator: the passkey made on the first
// is copied to the second, as a password manager syncs it. A copied passkey gives another PRF
// output, as some devices do, so the second device opens the data with the recovery code. The
// Worker checks the passkeys' real responses; Turnstile's test secret lets every token through
// (`playwright.config.ts`).

async function authenticator(page: Page, { prf }: { prf: boolean }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      hasPrf: prf,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId };
}

async function copyPasskeys(
  from: { cdp: CDPSession; authenticatorId: string },
  to: { cdp: CDPSession; authenticatorId: string },
) {
  const { credentials } = await from.cdp.send("WebAuthn.getCredentials", {
    authenticatorId: from.authenticatorId,
  });
  for (const credential of credentials) {
    await to.cdp.send("WebAuthn.addCredential", {
      authenticatorId: to.authenticatorId,
      credential,
    });
  }
}

async function secondDevice(page: Page) {
  const context = await page
    .context()
    .browser()!
    .newContext({
      baseURL: new URL(page.url()).origin,
      viewport: page.viewportSize(),
    });
  const other = await context.newPage();
  await standIn(other);
  return other;
}

test("a plan written on one device is on the other, and so are the orders added there", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+09:00"));
  const phoneKeys = await authenticator(page, { prf: true });
  const plan = await (await TopPage.open(page)).createPlan();
  await plan.addOrder("店A", "3300");
  // Read from the URL, so kept before leaving the plan.
  const planId = plan.id;
  await ProfilePage.open(page);
  const code = await new SyncSection(page).start();

  const pc = await secondDevice(page);
  await pc.clock.setFixedTime(new Date("2026-10-05T12:00:00+09:00"));
  await copyPasskeys(phoneKeys, await authenticator(pc, { prf: true }));
  await ProfilePage.open(pc);
  const pcSync = new SyncSection(pc);
  await pcSync.logIn();
  await pcSync.enterCode(code);
  await pcSync.waitSynced();

  const pcPlan = await PlanPage.open(pc, planId);
  await expect.poll(() => pcPlan.orderShops()).toEqual(["店A"]);
  // A plan with orders keeps the form shut until it is asked for.
  await pcPlan.orders.getByRole("button", { name: /^注文を追加/ }).click();
  await pcPlan.addOrder("店B", "2200");

  // Sent by the round that runs as the profile opens, if not already 2 seconds after it was saved.
  await ProfilePage.open(pc);
  await pcSync.waitSynced();

  // Read by the round that runs as the phone's app opens.
  const phonePlan = await PlanPage.open(page, planId);
  await expect.poll(() => phonePlan.orderShops()).toEqual(["店A", "店B"]);
});

test("a device whose passkey gives no key opens the data with the recovery code", async ({
  page,
}) => {
  const phoneKeys = await authenticator(page, { prf: true });
  await ProfilePage.open(page);
  const code = await new SyncSection(page).start();

  const pc = await secondDevice(page);
  await copyPasskeys(phoneKeys, await authenticator(pc, { prf: false }));
  await ProfilePage.open(pc);
  const pcSync = new SyncSection(pc);
  await pcSync.logIn();
  await pcSync.enterCode("AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AA");
  await expect(pcSync.codeDialog.getByText(/コードが違います/)).toBeVisible();
  await pcSync.enterCode(code);
  await pcSync.waitSynced();
});

test("the passkey that started the sync opens the data again without the code", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+09:00"));
  await authenticator(page, { prf: true });
  const plan = await (await TopPage.open(page)).createPlan();
  await plan.addOrder("店A", "3300");
  // Read from the URL, so kept before leaving the plan.
  const planId = plan.id;
  await ProfilePage.open(page);
  await new SyncSection(page).start();

  // The same device with its data gone, as a new phone with the same passkey.
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase("point-sprint");
        request.onsuccess = resolve;
        request.onerror = reject;
        request.onblocked = resolve;
      }),
  );
  const profile = await ProfilePage.open(page);
  const sync = new SyncSection(profile.page);
  await sync.logIn();
  await sync.waitSynced();
  await expect(sync.codeDialog).toBeHidden();
  const restored = await PlanPage.open(page, planId);
  await expect.poll(() => restored.orderShops()).toEqual(["店A"]);
});
