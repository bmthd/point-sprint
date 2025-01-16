import { act, renderHook } from "@testing-library/react";
import { useConfirmState } from "./hooks";

describe("useConfirmState", () => {
  test("初期状態がfalseであること", () => {
    const { result } = renderHook(() => useConfirmState());
    expect(result.current.isOpen).toBe(false);
  });

  test("確認関数が呼び出されたあと開閉状態がtrueになること", () => {
    const { result } = renderHook(() => useConfirmState());

    act(() => {
      void result.current.confirm();
    });

    expect(result.current.isOpen).toBe(true);
  });

  test.each([
    [true, "handleSuccess"],
    [false, "handleCancel"],
  ] as const)(
    "確認関数待機中に$handlerが呼び出された場合、Promiseが%sでresolveされ、開閉状態がfalseになること",
    async (expected, handler) => {
      const { result } = renderHook(() => useConfirmState());

      let confirmPromise: Promise<boolean> = Promise.resolve(!expected); // 型エラー回避のため一旦仮の値として期待しない値を設定
      act(() => {
        confirmPromise = result.current.confirm();
      });

      act(() => {
        result.current[handler]();
      });

      await expect(confirmPromise).resolves.toBe(expected);
      expect(result.current.isOpen).toBe(false);
    },
  );
});
