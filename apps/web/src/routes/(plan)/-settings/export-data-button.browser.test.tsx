import { useHydrateAtoms } from "jotai/utils";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { createMemoryRepository } from "#/storage/memory-repository.ts";
import type { Repository } from "#/storage/repository.ts";
import { PLAN, Providers, marathonPlan, shops } from "#/routes/(plan)/-test-fixtures.tsx";
import { ExportDataButton, saveFileAtom } from "./export-data-button.tsx";

function HydrateSave({
  save,
  children,
}: {
  save: (name: string, text: string) => void;
  children: ReactNode;
}) {
  useHydrateAtoms([[saveFileAtom, { save }]]);
  return children;
}

async function renderButton(repository: Repository) {
  await cleanup();
  const save = vi.fn<(name: string, text: string) => void>();
  const screen = await render(
    <Providers repository={repository}>
      <HydrateSave save={save}>
        <ExportDataButton />
      </HydrateSave>
    </Providers>,
  );
  return Object.assign(screen, { save });
}

test("saves the stored plans with the points the app calculates", async () => {
  const plan = marathonPlan();
  const screen = await renderButton(createMemoryRepository({ plans: [plan], shops }));
  const button = screen.getByRole("button", { name: "データを書き出す" });
  await expect.element(button).toBeEnabled();
  await button.click();

  expect(screen.save).toHaveBeenCalledOnce();
  const [name, text] = screen.save.mock.calls[0] ?? [];
  expect(name).toMatch(/^point-sprint-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(text ?? "");
  expect(data.plans).toEqual([plan]);
  expect(data.shops).toHaveLength(shops.length);
  const calculation = data.calculations.find((entry: { planId: string }) => entry.planId === PLAN);
  expect(calculation.result.total).toBeGreaterThan(0);
  const lineItems = plan.orders.flatMap((order) => order.lineItems.map((item) => item.id));
  expect(calculation.result.breakdown.map((row: { lineItemId: string }) => row.lineItemId)).toEqual(
    expect.arrayContaining(lineItems),
  );
});

test("cannot be pressed before the stored rows are read", async () => {
  const repository = createMemoryRepository({ shops });
  let release = () => {};
  const read = new Promise<void>((resolve) => {
    release = resolve;
  });
  const list = repository.plans.list.bind(repository.plans);
  repository.plans.list = async () => {
    await read;
    return list();
  };
  const screen = await renderButton(repository);
  const button = screen.getByRole("button", { name: "データを書き出す" });
  await expect.element(button).toBeDisabled();
  release();
  await expect.element(button).toBeEnabled();
});
