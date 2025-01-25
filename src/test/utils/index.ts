import { Providers } from "@/views/layout/components";
import "@testing-library/dom";
import {
  RenderHookOptions,
  render as rtlRender,
  renderHook as rtlRenderHook,
  type RenderOptions,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactElement } from "react";

interface RenderReturn extends ReturnType<typeof rtlRender> {
  /** セットアップ済みのuserEvent */
  user: ReturnType<typeof userEvent.setup>;
}

/**
 * Testing Libraryのrender関数のラッパー
 * @param ui テスト対象コンポーネント
 * @param options render関数のオプション
 * @returns render関数の戻り値 + userEventのセットアップ関数
 */
export const render = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderReturn => {
  const user = userEvent.setup();
  const result = rtlRender(ui, {
    wrapper: Providers,
    ...options,
  });
  return { user, ...result };
};

interface RenderHookReturn extends ReturnType<typeof rtlRenderHook> {
  /** セットアップ済みのuserEvent */
  user: ReturnType<typeof userEvent.setup>;
}

export const renderHook = <T>(
  render: (props: T | unknown) => ReturnType<typeof rtlRenderHook>,
  options?: RenderHookOptions<T>,
): RenderHookReturn => {
  const user = userEvent.setup();
  const result = rtlRenderHook(render, { wrapper: Providers, ...options });
  return { user, ...result };
};

export {
  act,
  fireEvent,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
export type { UserEvent } from "@testing-library/user-event";
