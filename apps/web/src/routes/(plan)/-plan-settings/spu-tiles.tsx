import {
  type Benefit,
  type CalculationResult,
  type Plan,
  channels,
  monthsOf,
  spuBenefitsOf,
  spuIdsIn,
  spuPurchaseRules,
  toggleSpu,
} from "@workspaces/domain";
import {
  Alert,
  Badge,
  type BadgeProps,
  Box,
  Flex,
  Button,
  Heading,
  Card,
  CheckboxCard,
  Image,
  Link,
  type LinkProps,
  Modal,
  SegmentedControl,
  SimpleGrid,
  Text,
  useDisclosure,
  VStack,
} from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { type ReactNode, useId, useState } from "react";
import { accountIdOf } from "../../../state/accounts";
import { accountSettingsAtom } from "../../../state/derived";
import { saveSpuMonthAtom } from "../../../state/mutations";
import { spuMonthsAtom } from "../../../state/queries";
import { ExternalIcon } from "../../../ui/icons";
import { useToday } from "../../-use-today";
import { monthText, useSpuOffMessages } from "../-warnings";
import { imageUrl, pointsText, rateText } from "../-order-shared";
import { SPU_PAGE_URL, useSaveSettingsChange } from "./settings-shared";

type RateBenefit = Extract<Benefit, { kind: "rate-bonus" }>;

/** 通常ポイント is always on and is not a tile. */
const isNormalPoint = (benefit: Benefit) =>
  benefit.category === "base" && benefit.label === "通常ポイント";

/**
 * The plan's SPU as tiles: every `spu` benefit, and the `base` ones the user may not get (the
 * card's own normal points), so they can be turned off.
 */
export const spuTiles = (benefits: Benefit[]): RateBenefit[] =>
  benefits.filter(
    (benefit): benefit is RateBenefit =>
      benefit.kind === "rate-bonus" &&
      (benefit.category === "spu" || (benefit.category === "base" && !isNormalPoint(benefit))),
  );

const enabledRate = (benefits: Benefit[], category: Benefit["category"]) =>
  benefits.reduce(
    (sum, benefit) =>
      benefit.kind === "rate-bonus" && benefit.category === category && benefit.enabled
        ? sum + benefit.params.rate
        : sum,
    0,
  );

/** The sum of the rates of the SPU (category `spu`) that are on. */
export const spuRate = (benefits: Benefit[]) => enabledRate(benefits, "spu");

const now = () => new Date();

/**
 * The SPU the plan's settings show: the account's for one month of the plan's period. `chosen` is
 * the month the user picked; the month of today when the period has it, or the first one, until
 * they pick one.
 */
export function usePlanSpu(plan: Plan, chosen?: string) {
  const settings = useAtomValue(accountSettingsAtom);
  const stored = useAtomValue(spuMonthsAtom);
  const today = useToday(now)?.slice(0, 7);
  const months = monthsOf(plan.period);
  const fallback = today !== undefined && months.includes(today) ? today : months[0];
  const month = chosen !== undefined && months.includes(chosen) ? chosen : (fallback ?? "");
  const accountId = accountIdOf(plan, settings);
  const account = settings.enabled
    ? settings.accounts.find((candidate) => candidate.id === accountId)
    : undefined;
  return {
    months,
    month,
    accountId,
    account,
    benefits: spuBenefitsOf(spuIdsIn(stored, accountId, month)),
  };
}

/** The card's normal points are shown under a short name. */
export const tileName = (benefit: Benefit) =>
  benefit.category === "base" && benefit.label.startsWith("楽天カード通常分")
    ? "楽天カード（通常）"
    : benefit.label;

const num = (value: number) => Number(value.toFixed(2)).toLocaleString("ja-JP");

function capText(benefit: Benefit) {
  const cap = benefit.params.cap;
  if (cap === undefined) return "上限なし";
  const scope = {
    month: "月間上限",
    plan: "このプランでの上限",
    campaign: "期間中の上限",
    occurrence: "開催ごとの上限",
  }[benefit.capScope];
  return `${scope} ${pointsText(cap)}`;
}

/** Tiles grow up to this size; the row fits as many columns as the width allows. */
const TILE_SIZE = "76px";
/**
 * Wider than a tile so long names under it wrap less. On a phone, narrower so a row holds four
 * tiles, which shrink to the column, and the names lose their side padding.
 */
const COLUMN_MIN_WIDTH = { base: "96px", sm: "72px" };

function Tile({
  benefit,
  capped,
  onToggle,
  onDetail,
}: {
  benefit: RateBenefit;
  capped: boolean;
  onToggle: () => void;
  onDetail: () => void;
}) {
  const name = tileName(benefit);
  const on = benefit.enabled;
  const badgeId = useId();
  return (
    <Flex direction="column" align="center" gap="1" minW="0">
      <CheckboxCard.Root
        checked={on}
        onChange={onToggle}
        colorScheme="primary"
        size="sm"
        withIndicator={false}
        w="full"
        maxW={TILE_SIZE}
        aspectRatio="1"
        alignItems="center"
        justifyContent="center"
        inputProps={{
          "aria-label": `${name} ${rateText(benefit.params.rate)}`,
          "aria-describedby": capped ? badgeId : undefined,
        }}
      >
        {benefit.imagePath ? (
          <Image src={imageUrl(benefit.imagePath)} alt={name} boxSize="8" objectFit="contain" />
        ) : null}
        <Text as="span" fontVariantNumeric="tabular-nums">
          +{num(benefit.params.rate)}
        </Text>
        {capped ? <CapBadge id={badgeId} position="absolute" top="-2" right="-2" /> : null}
      </CheckboxCard.Root>
      {/* Long names (楽天プレミアムカード（特典分）) wrap at a phrase, or anywhere when one phrase is wider than the column. */}
      <Button
        variant="ghost"
        size="xs"
        onClick={onDetail}
        aria-label={`${name}の上限と条件`}
        w="full"
        h="auto"
        minH="8"
        py="1"
        fontSize="2xs"
        whiteSpace="normal"
        px={{ base: "1", sm: "0" }}
        wordBreak="keep-all"
        overflowWrap="anywhere"
        lineHeight="moderate"
      >
        {name}
      </Button>
    </Flex>
  );
}

const noneCapped: ReadonlySet<string> = new Set();

/** 「上限」: the SPU reached its cap in this plan. */
function CapBadge(props: BadgeProps) {
  return (
    <Badge colorScheme="primary" variant="solid" fullRounded {...props}>
      上限
    </Badge>
  );
}

function SpuLink(props: LinkProps) {
  return (
    <Link
      href={SPU_PAGE_URL}
      color="link"
      target="_blank"
      rel="noreferrer"
      alignSelf="flex-start"
      gap="1.5"
      whiteSpace="nowrap"
      {...props}
    >
      楽天で自分のSPUを確認する
      <ExternalIcon />
    </Link>
  );
}

function DetailBody({
  benefit,
  capped,
  benefits,
}: {
  benefit: RateBenefit;
  capped: boolean;
  benefits: Benefit[];
}) {
  const others = benefits.filter(
    (other) =>
      other.id !== benefit.id &&
      benefit.exclusiveGroup !== undefined &&
      other.exclusiveGroup === benefit.exclusiveGroup,
  );
  const linked = benefits.filter(
    (other) => other.id === benefit.requires || other.requires === benefit.id,
  );
  const targets = benefit.conditions.channels?.map((id) => channels[id].label).join("・");
  const rule = spuPurchaseRules.find((candidate) => candidate.benefitId === benefit.id);
  return (
    <Flex direction="column" gap="2" fontSize="sm">
      <Box fontVariantNumeric="tabular-nums">
        <Text>倍率 {rateText(benefit.params.rate)}</Text>
        <Text>{capText(benefit)}</Text>
      </Box>
      {capped ? <Text color="primary.fg">このプランで上限に達しています</Text> : null}
      {targets ? <Text color="fg.muted">対象: {targets}での購入</Text> : null}
      <Text color="fg.muted">
        {benefit.amountBasis === "tax-included" ? "税込" : "税抜"}の金額にポイントが付きます。
      </Text>
      {others.length > 0 ? (
        <Text color="fg.muted">
          {others.map(tileName).join("・")}とは、どちらか一方だけ ON にできます。
        </Text>
      ) : null}
      {linked.length > 0 ? (
        <Text color="fg.muted">
          {linked.map(tileName).join("・")}と一緒に ON / OFF が切り替わります。
        </Text>
      ) : null}
      {rule ? (
        <Text color="fg.muted">
          {channels[rule.channel].label}で 1 回 {rule.minOrderAmount.toLocaleString("ja-JP")}
          円以上の注文を入れると、自動で ON になります。
        </Text>
      ) : null}
      <Text color="fg.muted">達成の条件は楽天のページで確かめて、達成したものを ON にします。</Text>
      <SpuLink />
    </Flex>
  );
}

/** The SPU tiles with the detail dialog behind each name. `capped` holds the ids that reached their cap. */
function SpuTileGrid({
  benefits,
  capped,
  onToggle,
}: {
  benefits: Benefit[];
  capped: ReadonlySet<string>;
  onToggle: (benefitId: string) => void;
}) {
  const detail = useDisclosure();
  const [detailId, setDetailId] = useState<string>();
  const tiles = spuTiles(benefits);
  const shown = tiles.find((benefit) => benefit.id === detailId);
  return (
    <>
      {tiles.length > 0 ? (
        <SimpleGrid
          role="group"
          aria-label="SPU のサービス"
          minChildWidth={COLUMN_MIN_WIDTH}
          columnGap={{ base: "1.5", sm: "1" }}
          rowGap="2"
        >
          {tiles.map((benefit) => (
            <Tile
              key={benefit.id}
              benefit={benefit}
              capped={capped.has(benefit.id)}
              onToggle={() => onToggle(benefit.id)}
              onDetail={() => {
                setDetailId(benefit.id);
                detail.onOpen();
              }}
            />
          ))}
        </SimpleGrid>
      ) : (
        <Text fontSize="sm" color="fg.muted">
          SPU はありません。
        </Text>
      )}
      <Modal.Root
        open={detail.open && shown !== undefined}
        onClose={detail.onClose}
        size="sm"
        title={shown ? tileName(shown) : undefined}
        body={
          shown ? (
            <DetailBody benefit={shown} capped={capped.has(shown.id)} benefits={benefits} />
          ) : null
        }
        cancel="閉じる"
        onCancel={detail.onClose}
      />
    </>
  );
}

/** The SPU card: the total rate, the tiles and their legend. */
export function SpuCard({
  title,
  note,
  picker,
  benefits,
  capped,
  warnings = [],
  onToggle,
}: {
  title: string;
  /** A line under the rate, for what the card's changes apply to. */
  note?: string;
  /** Above the note: what picks the SPU the card shows. */
  picker?: ReactNode;
  benefits: Benefit[];
  /** The ids that reached their cap. `undefined` when there is no plan to reach them in. */
  capped?: ReadonlySet<string>;
  /** Warnings shown above the tiles. */
  warnings?: string[];
  onToggle: (benefitId: string) => void;
}) {
  const normal = enabledRate(benefits, "base");
  const spu = enabledRate(benefits, "spu");
  const titleId = useId();

  return (
    // On a phone the smaller card leaves more width to the tiles.
    <Card.Root as="section" aria-labelledby={titleId} size={{ base: "md", sm: "sm" }}>
      <Card.Body alignItems="stretch">
        {/* The heading, the rate and its breakdown read as one block. */}
        <VStack gap="1" alignItems="stretch" fontVariantNumeric="tabular-nums">
          <Flex align="center" justify="space-between" gap="2">
            <Heading as="h2" id={titleId} fontSize="md">
              {title}
            </Heading>
            <Text fontSize="xs" color="fg.muted">
              達成したものを ON に
            </Text>
          </Flex>
          {/* 「ポイント倍率」 is what 楽天's SPU page calls this number. */}
          <Flex align="baseline" gap="2">
            <Text fontSize="sm" color="fg.muted">
              ポイント倍率
            </Text>
            <Text fontSize="4xl" fontWeight="bold" lineHeight="1.1">
              {num(normal + spu)}
              <Text as="span" fontSize="md" fontWeight="medium">
                倍
              </Text>
            </Text>
          </Flex>
          <Flex justify="space-between" gap="2" fontSize="xs" color="fg.muted">
            <Text whiteSpace="nowrap">
              通常 {num(normal)}倍 ＋ SPU{" "}
              <Text as="b" color="fg">
                +{num(spu)}倍
              </Text>
            </Text>
            <SpuLink fontSize="xs" alignSelf="auto" />
          </Flex>
        </VStack>
        {picker}
        {note ? (
          <Text fontSize="xs" color="fg.muted">
            {note}
          </Text>
        ) : null}

        {warnings.map((warning) => (
          <Alert.Root key={warning} status="warning" role="status" alignItems="center">
            <Alert.Icon />
            <Alert.Description>{warning}</Alert.Description>
          </Alert.Root>
        ))}

        <SpuTileGrid benefits={benefits} capped={capped ?? noneCapped} onToggle={onToggle} />

        <Flex wrap="wrap" align="center" columnGap="3" rowGap="1.5" fontSize="xs" color="fg.muted">
          <Flex as="span" align="center" gap="1">
            <Box
              as="span"
              boxSize="3"
              rounded="sm"
              bg="primary.subtle"
              borderWidth="1px"
              borderColor="primary.muted"
            />
            ON
          </Flex>
          <Flex as="span" align="center" gap="1">
            <Box as="span" boxSize="3" rounded="sm" borderWidth="1px" borderColor="border" />
            OFF
          </Flex>
          {capped ? (
            <Flex as="span" align="center" gap="1">
              <CapBadge as="span" />
              このプランで上限に達した
            </Flex>
          ) : null}
          <Text as="span" ms="auto">
            名前を押すと上限・条件
          </Text>
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}

/** `2026-10` → `2026年10月`. */
const yearMonthText = (month: string) => `${month.slice(0, 4)}年${monthText(month)}`;

/**
 * The plan's SPU card. The SPU is the account's for each month, so a change applies to every plan
 * of the account and month; a period of several months picks the month first.
 */
export function SpuTiles({ plan, result }: { plan: Plan; result: CalculationResult }) {
  const [chosen, setChosen] = useState<string>();
  const { months, month, accountId, account, benefits } = usePlanSpu(plan, chosen);
  const { mutateAsync: saveMonth } = useAtomValue(saveSpuMonthAtom);
  const save = useSaveSettingsChange(plan.id);
  const warnings = useSpuOffMessages(plan);
  const capped = new Set(
    result.benefitTotals.filter((total) => total.capReached).map((total) => total.benefitId),
  );
  const whose = account ? `${account.name}の` : "";
  const shared = account ? "同じアカウント・同じ月" : "同じ月";
  return (
    <SpuCard
      title="SPU"
      note={`${whose}${yearMonthText(month)}の SPU です。${shared}のプランすべてに反映されます。`}
      picker={
        months.length > 1 ? (
          <SegmentedControl.Root
            size="sm"
            aria-label="SPU の月"
            items={months.map((value) => ({ label: monthText(value), value }))}
            value={month}
            onChange={setChosen}
          />
        ) : undefined
      }
      benefits={benefits}
      capped={capped}
      warnings={warnings}
      onToggle={(benefitId) =>
        save(saveMonth({ accountId, month, change: (ids) => toggleSpu(ids, benefitId) }))
      }
    />
  );
}
