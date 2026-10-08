import { useState } from "react";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import {
  SettingsSaveFailureProvider,
  useSaveSettingsChange,
  useSettingsSaveFailurePlanId,
} from "./settings-shared";

test("records the plan whose settings save failed", async () => {
  function Example() {
    const save = useSaveSettingsChange("plan-a");
    const failedPlanId = useSettingsSaveFailurePlanId();
    return (
      <>
        <button type="button" onClick={() => save(Promise.reject(new Error("save failed")))}>
          保存
        </button>
        <output>{failedPlanId}</output>
      </>
    );
  }

  const screen = await render(
    <SettingsSaveFailureProvider>
      <Example />
    </SettingsSaveFailureProvider>,
  );
  await screen.getByRole("button", { name: "保存" }).click();

  await expect.element(screen.getByText("plan-a")).toBeVisible();
});

test("reports an earlier save failure after a later save starts", async () => {
  let failFirst: (() => void) | undefined;

  function Example() {
    const save = useSaveSettingsChange("plan-a");
    const failedPlanId = useSettingsSaveFailurePlanId();
    return (
      <>
        <button
          type="button"
          onClick={() =>
            save(
              new Promise((_, reject) => {
                failFirst = () => reject(new Error("first save failed"));
              }),
            )
          }
        >
          最初を保存
        </button>
        <button type="button" onClick={() => save(Promise.resolve())}>
          次を保存
        </button>
        <output>{failedPlanId}</output>
      </>
    );
  }

  const screen = await render(
    <SettingsSaveFailureProvider>
      <Example />
    </SettingsSaveFailureProvider>,
  );
  await screen.getByRole("button", { name: "最初を保存" }).click();
  await screen.getByRole("button", { name: "次を保存" }).click();
  failFirst?.();

  await expect.element(screen.getByText("plan-a")).toBeVisible();
});

test("clears a plan's failure when the settings view returns to it", async () => {
  function SettingsView({ planId }: { planId: string }) {
    const save = useSaveSettingsChange(planId);
    const failedPlanId = useSettingsSaveFailurePlanId();
    return (
      <>
        <button type="button" onClick={() => save(Promise.reject(new Error("save failed")))}>
          保存
        </button>
        <output>{failedPlanId ?? "なし"}</output>
      </>
    );
  }

  function Example() {
    const [planId, setPlanId] = useState("plan-a");
    return (
      <>
        <button type="button" onClick={() => setPlanId("plan-a")}>
          A
        </button>
        <button type="button" onClick={() => setPlanId("plan-b")}>
          B
        </button>
        <SettingsSaveFailureProvider key={planId}>
          <SettingsView planId={planId} />
        </SettingsSaveFailureProvider>
      </>
    );
  }

  const screen = await render(<Example />);
  await screen.getByRole("button", { name: "保存" }).click();
  await expect.element(screen.getByText("plan-a")).toBeVisible();
  await screen.getByRole("button", { name: "B" }).click();
  await screen.getByRole("button", { name: "A" }).click();

  await expect.element(screen.getByText("なし")).toBeVisible();
});
