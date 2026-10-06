import { ClientOnly, useNavigate } from "@tanstack/react-router";
import { type OfficialEvent, createPlan } from "@workspaces/domain";
import { Box, Heading, Text, VStack, styled } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { replacePlan, savePlanAtom } from "../../state/mutations";
import { profileAtom, profileQueryAtom } from "../../state/queries";
import { monthOf, msUntilTokyoMidnight, tokyoToday } from "./dates";
import { EventSection } from "./event-section";
import { PlanSection } from "./plan-section";
import { RouterLink } from "./router-link";

/** Today in Japan on the client, `undefined` in the HTML rendered ahead of time. */
export function useToday(now: () => Date): string | undefined {
  // `now` is read through a ref so a new function on each render does not subscribe again.
  const nowRef = useRef(now);
  nowRef.current = now;
  const subscribe = useCallback((onChange: () => void) => {
    let timer: ReturnType<typeof setTimeout>;
    // Wakes up at each midnight in Japan, so the date changes while the page stays open.
    const schedule = () => {
      timer = setTimeout(() => {
        onChange();
        schedule();
      }, msUntilTokyoMidnight(nowRef.current()));
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => tokyoToday(nowRef.current()),
    () => undefined,
  );
}

const footerLinks = [
  { href: "#help", label: "使い方・注意事項" },
  { href: "#notice", label: "お知らせ" },
  { href: "#terms", label: "利用規約" },
  { href: "#inquiry", label: "お問い合わせ" },
] as const;

function ProfileIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

/** What `now` is overridden by in tests; the default is the real clock. */
export function PlanList({ now = () => new Date() }: { now?: () => Date }) {
  const navigate = useNavigate();
  const today = useToday(now);
  const profile = useAtomValue(profileAtom);
  const { isSuccess: profileLoaded } = useAtomValue(profileQueryAtom);
  const { mutateAsync: savePlan } = useAtomValue(savePlanAtom);
  const [creating, setCreating] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  const create = async (event?: OfficialEvent) => {
    if (busy.current) return;
    busy.current = true;
    setCreating(true);
    setFailed(false);
    const date = now();
    const id = crypto.randomUUID();
    const month = monthOf(event ? event.period.start : tokyoToday(date));
    const name = event ? `${month}月 ${event.name}` : `${month}月の買い物`;
    try {
      await savePlan(
        replacePlan(
          createPlan({
            id,
            name,
            event,
            profile,
            now: date.toISOString(),
            newId: () => crypto.randomUUID(),
          }),
        ),
      );
      await navigate({ to: "/plan", search: { id } });
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setCreating(false);
    }
  };

  return (
    <Box bg="bg" color="fg" minH="100dvh">
      <Box maxW="3xl" mx="auto">
        <Box
          as="header"
          h="14"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          pl="4"
          pr="2"
        >
          <Text fontWeight="bold" fontSize="lg">
            ポイントスプリント
          </Text>
          <RouterLink
            to="/profile"
            aria-label="プロフィール（SPU・ショップ台帳）"
            boxSize="11"
            display="flex"
            alignItems="center"
            justifyContent="center"
            rounded="xl"
            color="fg"
            _hover={{ bg: "bg.muted" }}
          >
            <ProfileIcon />
          </RouterLink>
        </Box>
        <VStack as="main" alignItems="stretch" gap="6" px="4" pt="1" pb="8">
          <EventSection
            today={today}
            disabled={!profileLoaded || creating}
            onCreate={(event) => void create(event)}
            onCreateWithoutEvent={() => void create()}
          />
          {failed ? (
            <Text role="alert" fontSize="sm" color="danger.fg">
              プランを作れませんでした。もう一度お試しください。
            </Text>
          ) : null}
          <ClientOnly
            fallback={
              <Heading as="h2" fontSize="md">
                プラン
              </Heading>
            }
          >
            <PlanSection />
          </ClientOnly>
          <Text fontSize="xs" color="fg.muted">
            入力した内容はこのブラウザの中にだけ保存されます。ブラウザのデータを消すと、プランも消えます。
          </Text>
          <Box display="flex" justifyContent="center" gap="4" fontSize="sm" flexWrap="wrap">
            {/* Kept as `styled.a`: the footer moves to the shared layout in #91, which replaces it there. */}
            {footerLinks.map((link) => (
              <styled.a
                key={link.href}
                href={link.href}
                color="link"
                minH="11"
                display="flex"
                alignItems="center"
              >
                {link.label}
              </styled.a>
            ))}
          </Box>
        </VStack>
      </Box>
    </Box>
  );
}
