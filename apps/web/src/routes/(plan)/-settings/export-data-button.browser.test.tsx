import { expect, onTestFinished, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { createMemoryRepository } from "#/storage/memory-repository.ts";
import type { Repository } from "#/storage/repository.ts";
import { PLAN, Providers, marathonPlan, shops } from "#/routes/(plan)/-test-fixtures.tsx";
import { ExportDataButton } from "./export-data-button.tsx";

async function renderButton(repository: Repository) {
  await cleanup();
  return render(
    <Providers repository={repository}>
      <ExportDataButton />
    </Providers>,
  );
}

/** The files the page downloads, by name, instead of downloading them. */
function catchDownloads() {
  const blobs = new Map<string, Blob>();
  const files: { name: string; blob: Blob | undefined }[] = [];
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    const url = `blob:test/${blobs.size}`;
    blobs.set(url, blob as Blob);
    return url;
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    files.push({ name: this.download, blob: blobs.get(this.href) });
  });
  onTestFinished(() => {
    createObjectURL.mockRestore();
    click.mockRestore();
  });
  return files;
}

test("saves the stored plans with the points the app calculates", async () => {
  const plan = marathonPlan();
  const files = catchDownloads();
  const screen = await renderButton(createMemoryRepository({ plans: [plan], shops }));
  const button = screen.getByRole("button", { name: "データを書き出す" });
  await expect.element(button).toBeEnabled();
  await button.click();

  expect(files).toHaveLength(1);
  const [file] = files;
  expect(file?.name).toMatch(/^point-sprint-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse((await file?.blob?.text()) ?? "");
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
