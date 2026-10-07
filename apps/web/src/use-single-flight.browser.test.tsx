import { useState } from "react";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { useSingleFlight } from "./use-single-flight";

test("runs only the first operation while it is pending", async () => {
  let finish: (() => void) | undefined;

  function Example() {
    const run = useSingleFlight();
    const [started, setStarted] = useState(0);
    const [completed, setCompleted] = useState(0);
    const start = () => {
      void run(async () => {
        setStarted((count) => count + 1);
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        setCompleted((count) => count + 1);
      });
    };

    return (
      <>
        <button type="button" onClick={start}>
          保存
        </button>
        <output>{`${started}/${completed}`}</output>
      </>
    );
  }

  const screen = await render(<Example />);
  const save = screen.getByRole("button", { name: "保存" });

  await save.click();
  await save.click();
  await expect.element(screen.getByText("1/0")).toBeVisible();

  finish?.();
  await expect.element(screen.getByText("1/1")).toBeVisible();
});

test("runs another operation after the first one rejects", async () => {
  let failed = false;

  function Example() {
    const run = useSingleFlight();
    const [started, setStarted] = useState(0);
    const [completed, setCompleted] = useState(0);
    const start = () => {
      void run(async () => {
        setStarted((count) => count + 1);
        if (!failed) {
          failed = true;
          throw new Error("save failed");
        }
        setCompleted((count) => count + 1);
      }).catch(() => {});
    };

    return (
      <>
        <button type="button" onClick={start}>
          保存
        </button>
        <output>{`${started}/${completed}`}</output>
      </>
    );
  }

  const screen = await render(<Example />);
  const save = screen.getByRole("button", { name: "保存" });

  await save.click();
  await expect.element(screen.getByText("1/0")).toBeVisible();
  await save.click();

  await expect.element(screen.getByText("2/1")).toBeVisible();
});
