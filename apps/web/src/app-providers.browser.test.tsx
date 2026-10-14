import { CURRENT_SCHEMA_VERSION } from "@workspaces/domain";
import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { useAtomValue } from "jotai";
import { afterEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { AppProviders } from "./app-providers";
import { plansQueryAtom } from "./state/queries";
import { createIndexedDbRepository } from "./storage/indexed-db-repository";

afterEach(
  () =>
    new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("point-sprint");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }),
);

function Plans() {
  useAtomValue(plansQueryAtom);
  return null;
}

test("a page whose database a newer app upgraded asks to reload", async () => {
  await createIndexedDbRepository({
    migrations: [{ to: CURRENT_SCHEMA_VERSION + 1, stores: {} }],
  }).plans.list();

  const screen = await render(
    <UIProvider theme={theme} config={config}>
      <AppProviders>
        <Plans />
      </AppProviders>
    </UIProvider>,
  );

  await expect
    .element(screen.getByRole("heading", { name: "新しい版に更新されました" }))
    .toBeVisible();
  await expect.element(screen.getByRole("button", { name: "再読み込み" })).toBeVisible();
});
