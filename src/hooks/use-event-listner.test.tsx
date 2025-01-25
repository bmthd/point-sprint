import { act, fireEvent, renderHook, screen } from "@/test/utils";
import { useEventListener } from "./use-event-listener";

afterEach(() => {
  vi.resetAllMocks();
});

describe.each([
  { name: "Element", target: document.createElement("div") },
  { name: "Document", target: document },
  { name: "Window", target: window },
  {
    name: "RefObject",
    target: { current: document.createElement("div") },
  },
])("useEventListener:$name", ({ target }) => {
  it("adds an event listener to the target", async () => {
    const handler = vi.fn();
    const { user } = renderHook(() => useEventListener("click", handler, target));
    const clickTarget = target instanceof Object && "current" in target ? target.current : target;
    await user.click(
      // @ts-expect-error
      clickTarget,
    );
    expect(handler).toHaveBeenCalled();
  });

  it("cleans up the event listener on unmount", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() => useEventListener("keydown", handler, target), {
      wrapper: ({ children }) => <span>{children}</span>,
    });
    screen.debug();
    unmount();
    screen.debug();
    const keyDownTarget = target instanceof Object && "current" in target ? target.current : target;
    act(() => {
      fireEvent.keyDown(keyDownTarget, { key: "Enter" });
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("updates the event listener when handler changes", () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    const { rerender } = renderHook(({}) => useEventListener("click", handler, target), {
      initialProps: { handler: firstHandler },
    });

    const clickTarget = target instanceof Object && "current" in target ? target.current : target;
    act(() => {
      fireEvent.click(clickTarget);
    });
    expect(firstHandler).toHaveBeenCalled();
    firstHandler.mockReset();

    rerender({ handler: secondHandler });
    act(() => {
      fireEvent.click(clickTarget);
    });
    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalled();
  });
});
