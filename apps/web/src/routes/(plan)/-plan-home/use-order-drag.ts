import { type PointerEvent, type RefObject, useEffect, useLayoutEffect, useState } from "react";

/** How far a pressed handle moves before the press becomes a drag, in px. */
const DRAG_THRESHOLD = 4;
/** How close to the top or bottom of the window the pointer scrolls it while dragging, in px. */
const SCROLL_EDGE = 48;
/** How far the window scrolls each frame with the pointer at its very edge, in px. */
const SCROLL_SPEED = 16;

type Drag = {
  pointerId: number;
  handle: HTMLElement;
  row: HTMLElement;
  from: number;
  onStart: () => void;
  onDrop: (to: number) => Promise<unknown>;
  /** Where the press started, in the list's coordinates. */
  startY: number;
  /** The row's top at the start, less the pointer's: kept under the pointer as it moves. */
  grabOffset: number;
  clientY: number;
  to: number;
  started: boolean;
  frame: number;
};

export type DragStart = (
  event: PointerEvent<HTMLElement>,
  row: {
    /** The row's index in the list. */
    from: number;
    /** Called once the press has moved far enough to be a drag. */
    onStart: () => void;
    /** Moves the order to the index it was dropped at, which is not `from`. */
    onDrop: (to: number) => Promise<unknown>;
  },
) => void;

/**
 * Moves an order's row up and down under the pointer that pressed its handle, and the other rows
 * aside to leave room where it will land. The rows are moved with transforms written to their
 * elements, so a drag renders nothing until it is dropped: then `onDrop` gets the new index.
 */
export function useOrderDrag({
  listRef,
  orders,
}: {
  listRef: RefObject<HTMLElement | null>;
  /** Changes when the orders are reordered, which puts every row back where it is laid out. */
  orders: unknown;
}): DragStart {
  const [drag] = useState(() => dragOf(listRef));

  // The reordered rows are laid out where they were moved to, so their transforms come off at once.
  useLayoutEffect(() => {
    if (!drag.active()) drag.settle();
  }, [orders, drag]);

  // A list that goes away stops its drag, which would scroll the window on every frame.
  useEffect(() => () => drag.cancel(), [drag]);

  return drag.start;
}

/** The drag of one list's rows, made once for the list so its `start` stays the same function. */
function dragOf(listRef: RefObject<HTMLElement | null>) {
  let current: Drag | null = null;

  const rowsOf = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLElement>(":scope > li[data-order-id]") ?? []);

  const settle = () => {
    const list = listRef.current;
    if (!list) return;
    delete list.dataset.dragging;
    for (const row of rowsOf()) {
      row.style.transform = "";
      delete row.dataset.dragged;
    }
  };

  const listTop = () => listRef.current?.getBoundingClientRect().top ?? 0;

  /** Puts the dragged row under the pointer and the others aside, for where the pointer is now. */
  const place = (drag: Drag) => {
    const rows = rowsOf();
    const { row } = drag;
    const y = drag.clientY - listTop();
    // Rows are laid out by `offsetTop`, which leaves out their transforms. The dragged row stays
    // inside the list, above the add form.
    const first = rows[0]?.offsetTop ?? 0;
    const last = rows.at(-1);
    const listBottom = last ? last.offsetTop + last.offsetHeight : 0;
    const top = Math.min(Math.max(y - drag.grabOffset, first), listBottom - row.offsetHeight);
    row.style.transform = `translateY(${top - row.offsetTop}px)`;

    // The dragged row goes past another once it covers half of it: its top going up, its bottom
    // going down.
    const bottom = top + row.offsetHeight;
    let to = 0;
    for (const [index, other] of rows.entries()) {
      const middle = other.offsetTop + other.offsetHeight / 2;
      if (index < drag.from ? middle < top : index > drag.from && middle <= bottom) to += 1;
    }
    drag.to = to;
    for (const [index, other] of rows.entries()) {
      if (index === drag.from) continue;
      const shift =
        drag.from < index && index <= to
          ? -row.offsetHeight
          : to <= index && index < drag.from
            ? row.offsetHeight
            : 0;
      other.style.transform = shift ? `translateY(${shift}px)` : "";
    }
  };

  /**
   * Each frame, scrolls the window while the pointer is near its top or bottom, and places the
   * rows again: a scroll or an opened row closing moves them under the pointer.
   */
  const follow = (drag: Drag) => {
    const nearTop = SCROLL_EDGE - drag.clientY;
    const nearBottom = drag.clientY - (window.innerHeight - SCROLL_EDGE);
    const step =
      nearTop > 0
        ? -Math.ceil((SCROLL_SPEED * nearTop) / SCROLL_EDGE)
        : nearBottom > 0
          ? Math.ceil((SCROLL_SPEED * nearBottom) / SCROLL_EDGE)
          : 0;
    if (step !== 0) window.scrollBy(0, step);
    place(drag);
    drag.frame = requestAnimationFrame(() => follow(drag));
  };

  const end = (drag: Drag, drop: boolean) => {
    current = null;
    cancelAnimationFrame(drag.frame);
    drag.handle.removeEventListener("pointermove", onMove);
    drag.handle.removeEventListener("pointerup", onUp);
    drag.handle.removeEventListener("pointercancel", onCancel);
    if (drag.handle.hasPointerCapture(drag.pointerId)) {
      drag.handle.releasePointerCapture(drag.pointerId);
    }
    if (!drag.started) return;
    if (!drop || drag.to === drag.from) {
      settle();
      return;
    }
    // The rows stay where they were moved to until the reordered list is laid out, or the move
    // fails and they go back.
    drag
      .onDrop(drag.to)
      .catch(() => {})
      .finally(() => {
        if (!current) settle();
      });
  };

  function onMove(event: globalThis.PointerEvent) {
    const drag = current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.clientY = event.clientY;
    if (!drag.started) {
      if (Math.abs(event.clientY - listTop() - drag.startY) < DRAG_THRESHOLD) return;
      drag.started = true;
      drag.onStart();
      const list = listRef.current;
      if (list) list.dataset.dragging = "";
      drag.row.dataset.dragged = "";
      drag.frame = requestAnimationFrame(() => follow(drag));
    }
    place(drag);
  }

  function onUp(event: globalThis.PointerEvent) {
    const drag = current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.clientY = event.clientY;
    if (drag.started) place(drag);
    end(drag, true);
  }

  function onCancel(event: globalThis.PointerEvent) {
    const drag = current;
    if (drag && event.pointerId === drag.pointerId) end(drag, false);
  }

  const start: DragStart = (event, { from, onStart, onDrop }) => {
    if (current || !event.isPrimary || event.button !== 0) return;
    const handle = event.currentTarget;
    const row = handle.closest<HTMLElement>("li[data-order-id]");
    if (!row) return;
    const startY = event.clientY - listTop();
    const drag: Drag = {
      pointerId: event.pointerId,
      handle,
      row,
      from,
      onStart,
      onDrop,
      startY,
      grabOffset: startY - row.offsetTop,
      clientY: event.clientY,
      to: from,
      started: false,
      frame: 0,
    };
    current = drag;
    // Captured, the pointer keeps moving the row when it leaves the handle or the window.
    handle.setPointerCapture(event.pointerId);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onCancel);
  };

  return {
    start,
    settle,
    active: () => current !== null,
    cancel: () => {
      if (current) end(current, false);
    },
  };
}
