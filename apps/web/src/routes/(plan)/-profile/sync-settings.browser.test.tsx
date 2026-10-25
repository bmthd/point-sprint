import { expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { createMemoryRepository } from "../../../storage/memory-repository";
import type { Repository } from "../../../storage/repository";
import type { Passkeys, SyncServer } from "../../../storage/sync-passkey";
import type { TurnstileWidgetProps } from "../../-turnstile-widget";
import { Providers } from "../-test-fixtures";
import { SyncSettings } from "./sync-settings";

// The passkeys, Turnstile and the server are stood in for: what is tested is what the section
// asks of the user.

function FakeWidget({ onToken }: TurnstileWidgetProps) {
  return (
    <button type="button" onClick={() => onToken("token")}>
      確認を済ませる
    </button>
  );
}

const passkeys: Passkeys = {
  create: async (options) => ({
    response: {
      id: "credential-1",
      rawId: "credential-1",
      type: "public-key",
      response: { clientDataJSON: options.challenge, attestationObject: "" },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    } as never,
    prfEnabled: false,
    prf: undefined,
  }),
  get: async (options) => ({
    response: {
      id: "credential-1",
      rawId: "credential-1",
      type: "public-key",
      response: { clientDataJSON: options.challenge, authenticatorData: "", signature: "" },
      clientExtensionResults: {},
    } as never,
    prf: undefined,
  }),
};

const creation = {
  challenge: "challenge",
  rp: { name: "ポイントスプリント", id: "localhost" },
  user: { id: "user", name: "ポイントスプリント", displayName: "ポイントスプリント" },
  pubKeyCredParams: [],
};

const fakeServer = (overrides: Partial<SyncServer> = {}): SyncServer => ({
  startOptions: async () => ({ challengeId: "c", options: creation }),
  addPasskeyOptions: async () => ({ challengeId: "c", options: creation }),
  register: async () => ({ accountId: "account", credentialId: "credential-1" }),
  loginOptions: async () => ({ challengeId: "c", options: { challenge: "challenge" } }),
  login: async () => ({
    accountId: "account",
    credentialId: "credential-1",
    prfWrap: null,
    recoveryWrap: "not-a-wrap",
  }),
  recoveryLogin: async () => undefined,
  setPrfWrap: async () => true,
  stop: async () => ({ ok: true }),
  push: async () => ({ ok: true }),
  pull: async () => ({ ok: true, records: [], seq: 0, more: false }),
  ...overrides,
});

async function renderSettings(
  server: SyncServer,
  repository: Repository = createMemoryRepository(),
) {
  await cleanup();
  return render(
    <Providers repository={repository}>
      <SyncSettings server={server} siteKey="site-key" passkeys={passkeys} widget={FakeWidget} />
    </Providers>,
  );
}

test("the recovery code cannot be closed before the user says they kept it", async () => {
  const screen = await renderSettings(fakeServer());
  await screen.getByRole("button", { name: "パスキーで同期を始める" }).click();
  await screen.getByRole("button", { name: "確認を済ませる" }).click();
  await screen.getByRole("button", { name: "パスキーを作って始める" }).click();

  const dialog = screen.getByRole("dialog", { name: "復元用のコードを控えてください" });
  await expect.element(dialog).toBeVisible();
  await expect.element(dialog.getByText(/^([0-9A-Z]{4}-){6}[0-9A-Z]{2}$/)).toBeVisible();
  await expect.element(dialog.getByText(/このコードも入れてください/)).toBeVisible();
  const close = dialog.getByRole("button", { name: "閉じる" });
  await expect.element(close).toBeDisabled();
  await dialog.getByText("控えました").click();
  await close.click();
  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "同期をやめる" })).toBeVisible();
});

test("a device the passkey does not open asks for the code, and says when it is wrong", async () => {
  const screen = await renderSettings(fakeServer());
  await screen.getByRole("button", { name: "ほかの端末で始めた同期にログイン" }).click();

  const dialog = screen.getByRole("dialog", { name: "復元用のコードを入れてください" });
  await expect.element(dialog).toBeVisible();
  await dialog
    .getByRole("textbox", { name: "復元用のコード" })
    .fill("AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AA");
  await dialog.getByRole("button", { name: "開く" }).click();
  await expect.element(dialog.getByText(/コードが違います/)).toBeVisible();
});

test("a refused passkey says so", async () => {
  const screen = await renderSettings(fakeServer({ login: async () => undefined }));
  await screen.getByRole("button", { name: "ほかの端末で始めた同期にログイン" }).click();
  await expect
    .element(screen.getByRole("alert").getByText(/パスキーでログインできませんでした/))
    .toBeVisible();
});

test("stopping asks first, then removes the data on the server", async () => {
  const stop = vi.fn<SyncServer["stop"]>(async () => ({ ok: true }));
  const repository = createMemoryRepository();
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  await repository.sync.meta.put({ accountId: "a", cursor: 0, encryptionKey: key, idKey: key });
  const screen = await renderSettings(fakeServer({ stop }), repository);

  await screen.getByRole("button", { name: "同期をやめる" }).click();
  const dialog = screen.getByRole("dialog", { name: "同期をやめますか？" });
  await dialog.getByRole("button", { name: "同期をやめる" }).click();
  await expect.poll(() => stop.mock.calls.length).toBe(1);
  await expect
    .element(screen.getByRole("button", { name: "パスキーで同期を始める" }))
    .toBeVisible();
  expect(await repository.sync.meta.get()).toBeUndefined();
});
