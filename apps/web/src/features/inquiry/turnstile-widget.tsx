import { Box, Text } from "@workspaces/ui";
import { useEffect, useRef, useState } from "react";
import { useLatestRef } from "../../use-latest-ref";

// Cloudflare Turnstile's widget, rendered by its script once the page is in the browser.

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type RenderOptions = {
  sitekey: string;
  language?: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

type Turnstile = {
  render: (container: HTMLElement, options: RenderOptions) => string | undefined;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | undefined;

/** Loads the script once for the page. A failed load is tried again by the next widget. */
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("no turnstile"));
    script.onerror = () => {
      script.remove();
      loading = undefined;
      reject(new Error("turnstile did not load"));
    };
    document.head.append(script);
  });
  return loading;
}

export type TurnstileWidgetProps = {
  siteKey: string;
  /** A token once the check passes, and `undefined` when it expires or fails. */
  onToken: (token: string | undefined) => void;
  /** Starts the check again when it changes: a token is good for one submission only. */
  resetKey: number;
};

export function TurnstileWidget({ siteKey, onToken, resetKey }: TurnstileWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const onTokenRef = useLatestRef(onToken);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile().then(
      (turnstile) => {
        if (cancelled || !container.current) return;
        widgetId.current = turnstile.render(container.current, {
          sitekey: siteKey,
          language: "ja",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(undefined),
          "error-callback": () => onTokenRef.current(undefined),
        });
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
      if (widgetId.current !== undefined) window.turnstile?.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [siteKey, onTokenRef]);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current !== undefined) window.turnstile?.reset(widgetId.current);
  }, [resetKey]);

  return (
    <Box>
      {/* The managed widget is 65px tall: kept so the button does not move when it appears. */}
      <Box ref={container} minH="65px" />
      {failed ? (
        <Text role="alert" fontSize="sm" color="danger.fg">
          確認のための部品を読み込めませんでした。ページを読み込み直してください。
        </Text>
      ) : null}
    </Box>
  );
}
