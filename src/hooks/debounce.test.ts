import { renderHook } from "@testing-library/react";
import { useDebounce } from "./debounce";

describe("debounce", () => {
  it("should debounce the function", async () => {
    const fn = vi.fn<(a: number, b: string) => boolean>();
    const { result } = renderHook(useDebounce);
    result.current(() => fn(1, "b"), 100);
    expect(fn).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fn).toHaveBeenCalledWith(1, "b");
  });

  it("should cancel the previous call", async () => {
    const fn = vi.fn<(a: number, b: string) => boolean>();
    const { result } = renderHook(useDebounce);
    const debounce = result.current;
    debounce(() => fn(1, "b"), 100);
    debounce(() => fn(2, "c"), 100);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fn).not.toHaveBeenCalledWith(1, "b");
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fn).toHaveBeenCalledWith(2, "c");
  });
});
