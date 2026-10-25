import {
  type Benefit,
  CARRIED_SPU_IDS,
  type Plan,
  channels,
  plansUsingSpuMonth,
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
  Button,
  Card,
  CheckboxCard,
  Flex,
  Heading,
  Image,
  Link,
  type LinkProps,
  List,
  Modal,
  NativeAccordion,
  SimpleGrid,
  Text,
  VStack,
  useDisclosure,
} from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useId, useState } from "react";
import { withEffectiveAccount } from "../../../state/accounts";
import { accountSettingsAtom, planResultAtom } from "../../../state/derived";
import { saveSpuMonthAtom } from "../../../state/mutations";
import { plansAtom, spuMonthsAtom } from "../../../state/queries";
import { ExternalIcon } from "../../../ui/icons";
import { imageUrl, pointsText, rateText } from "../-order-shared";
import { monthDay, monthText, useSpuOffMessages } from "../-warnings";

/** Rakuten's page where users check their own SPU. */
const SPU_PAGE_URL = "https://event.rakuten.co.jp/campaign/point-up/everyday/point/";

type RateBenefit = Extract<Benefit, { kind: "rate-bonus" }>;

/** 通常ポイント is always on and is not a tile. */
const isNormalPoint = (benefit: Benefit) =>
  benefit.category === "base" && benefit.label === "通常ポイント";

/**
 * The SPU as tiles: every `spu` benefit, and the `base` ones the user may not get (the card's own
 * normal points), so they can be turned off.
 */
const spuTiles = (benefits: Benefit[]): RateBenefit[] =>
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

/** The ポイント倍率 of the SPU items `ids`: 通常 and SPU together, as 楽天's SPU page shows it. */
export const spuMonthRate = (ids: ReadonlySet<string>) => {
  const benefits = spuBenefitsOf(ids);
  return enabledRate(benefits, "base") + enabledRate(benefits, "spu");
};

export const num = (value: number) => Number(value.toFixed(2)).toLocaleString("ja-JP");

/** `2026-11` → `11月`, or `2027年1月` when it is not of the year of `today`. */
export const spuMonthText = (month: string, today: string | undefined) =>
  today === undefined || today.startsWith(month.slice(0, 4))
    ? monthText(month)
    : `${month.slice(0, 4)}年${monthText(month)}`;

/** The card's normal points are shown under a short name. */
const tileName = (benefit: Benefit) =>
  benefit.category === "base" && benefit.label.startsWith("楽天カード通常分")
    ? "楽天カード（通常）"
    : benefit.label;

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

/** 「上限」: the SPU reached its cap in the plan the SPU was opened from. */
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
      <SpuLink alignSelf="flex-start" />
    </Flex>
  );
}

/**
 * One group of tiles under its heading. `benefits` are all the month's items, for the dialog to
 * name the items a tile goes with.
 */
function TileGroup({
  title,
  note,
  tiles,
  benefits,
  capped,
  onToggle,
}: {
  title: string;
  note: string;
  tiles: RateBenefit[];
  benefits: Benefit[];
  capped: ReadonlySet<string>;
  onToggle: (benefitId: string) => void;
}) {
  const detail = useDisclosure();
  const [detailId, setDetailId] = useState<string>();
  const shown = tiles.find((benefit) => benefit.id === detailId);
  const titleId = useId();
  return (
    <Box as="section" aria-labelledby={titleId}>
      <Flex wrap="wrap" align="baseline" justify="space-between" columnGap="2" mb="2.5">
        <Heading as="h3" id={titleId} fontSize="sm">
          {title}
        </Heading>
        <Text fontSize="xs" color="fg.muted">
          {note}
        </Text>
      </Flex>
      <SimpleGrid
        role="group"
        aria-label={title}
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
    </Box>
  );
}

/** The plans the month's SPU is used by, folded: what a change to it reaches. */
function UsingPlans({ accountId, month }: { accountId: string; month: string }) {
  const plans = useAtomValue(plansAtom);
  const settings = useAtomValue(accountSettingsAtom);
  const using = plansUsingSpuMonth(
    plans.map((plan) => withEffectiveAccount(plan, settings)),
    accountId,
    month,
  );
  const ofMonth = `${monthText(month)}の`;
  return (
    <NativeAccordion.Root variant="panel" animate={false}>
      <NativeAccordion.Item>
        <NativeAccordion.Button>この SPU で計算するプラン {using.length}件</NativeAccordion.Button>
        <NativeAccordion.Panel>
          <VStack gap="1.5" alignItems="stretch" fontSize="sm">
            <Text fontSize="xs" color="fg.muted">
              {ofMonth}日付の注文は、どのプランでもこの SPU で計算します。
            </Text>
            {using.length > 0 ? (
              <List.Root aria-label="この SPU で計算するプラン" gap="1">
                {using.map(({ plan, orders }) => (
                  <List.Item key={plan.id}>
                    <Text as="b">{plan.name}</Text>（{monthDay(plan.period.start)}〜
                    {monthDay(plan.period.end)}）
                    {orders > 0 ? `${ofMonth}注文 ${orders}件` : "注文はまだありません"}
                  </List.Item>
                ))}
              </List.Root>
            ) : (
              <Text>{ofMonth}プランはまだありません。</Text>
            )}
            {using.length > 0 ? (
              <Text fontSize="xs" color="fg.muted">
                切り替えると、これらのプランの獲得予定が変わります。
              </Text>
            ) : null}
          </VStack>
        </NativeAccordion.Panel>
      </NativeAccordion.Item>
    </NativeAccordion.Root>
  );
}

function SpuOffWarnings({ plan, month }: { plan: Plan; month: string }) {
  const warnings = useSpuOffMessages(plan, month);
  return warnings.map((warning) => (
    <Alert.Root key={warning} status="warning" role="status" alignItems="center">
      <Alert.Icon />
      <Alert.Description>{warning}</Alert.Description>
    </Alert.Root>
  ));
}

const noneCapped: ReadonlySet<string> = new Set();

/**
 * The SPU of `accountId` in `month`, for the user to turn on what they achieve. It is shared by
 * every plan of the account with orders of the month, which it lists. Opened from a plan
 * (`planId`), it marks the items that reached their cap in that plan.
 */
export function SpuMonthEditor({
  accountId,
  month,
  planId,
}: {
  accountId: string;
  month: string;
  planId?: string | undefined;
}) {
  const stored = useAtomValue(spuMonthsAtom);
  const plans = useAtomValue(plansAtom);
  const result = useAtomValue(planResultAtom(planId ?? ""));
  const { mutateAsync: saveMonth } = useAtomValue(saveSpuMonthAtom);
  const [failed, setFailed] = useState(false);
  const plan = plans.find((candidate) => candidate.id === planId);
  const benefits = spuBenefitsOf(spuIdsIn(stored, accountId, month));
  const tiles = spuTiles(benefits);
  const capped = result
    ? new Set(
        result.benefitTotals.filter((total) => total.capReached).map((total) => total.benefitId),
      )
    : noneCapped;
  const normal = enabledRate(benefits, "base");
  const spu = enabledRate(benefits, "spu");
  const toggle = (benefitId: string) => {
    setFailed(false);
    saveMonth({ accountId, month, change: (ids) => toggleSpu(ids, benefitId) }).catch(() =>
      setFailed(true),
    );
  };
  const group = { benefits, capped, onToggle: toggle };

  return (
    // On a phone the smaller card leaves more width to the tiles.
    <Card.Root as="section" aria-label="SPU" size={{ base: "md", sm: "sm" }}>
      <Card.Body alignItems="stretch" gap="4">
        {failed ? (
          <Text role="alert" fontSize="sm" color="danger.fg">
            変更を保存できませんでした。もう一度お試しください。
          </Text>
        ) : null}
        <NativeAccordion.Root animate={false}>
          <NativeAccordion.Item>
            <NativeAccordion.Button>SPU とは</NativeAccordion.Button>
            <NativeAccordion.Panel>
              <Text fontSize="sm">
                楽天カードや楽天モバイルなど、楽天のサービスを使っているほど、楽天市場の買い物でもらえるポイントの倍率が上がる仕組みです。楽天は、どのサービスを使ったかを月ごとに判定します。使っているサービスを
                ON にすると、その月の日付の注文のポイントに加わります。
              </Text>
            </NativeAccordion.Panel>
          </NativeAccordion.Item>
        </NativeAccordion.Root>
        {/* 「ポイント倍率」 is what 楽天's SPU page calls this number. */}
        <Flex wrap="wrap" align="baseline" columnGap="2" fontVariantNumeric="tabular-nums">
          <Text fontSize="sm" color="fg.muted">
            ポイント倍率
          </Text>
          <Text fontSize="4xl" fontWeight="bold" lineHeight="1.1">
            {num(normal + spu)}
            <Text as="span" fontSize="md" fontWeight="medium">
              倍
            </Text>
          </Text>
          <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
            通常 {num(normal)}倍 ＋ SPU{" "}
            <Text as="b" color="fg">
              +{num(spu)}倍
            </Text>
          </Text>
        </Flex>
        <UsingPlans accountId={accountId} month={month} />
        {plan ? <SpuOffWarnings plan={plan} month={month} /> : null}
        <TileGroup
          title="契約・お支払いで決まる"
          note="次の月にも引き継ぎます"
          tiles={tiles.filter((benefit) => CARRIED_SPU_IDS.has(benefit.id))}
          {...group}
        />
        <TileGroup
          title="その月の利用で決まる"
          note="毎月 OFF から。達成したら ON に"
          tiles={tiles.filter((benefit) => !CARRIED_SPU_IDS.has(benefit.id))}
          {...group}
        />
        <Flex wrap="wrap" align="center" columnGap="3" rowGap="1.5" fontSize="xs" color="fg.muted">
          {capped.size > 0 ? (
            <Flex as="span" align="center" gap="1">
              <CapBadge as="span" />
              このプランで上限に達した
            </Flex>
          ) : null}
          <Text as="span">名前を押すと達成の条件と上限</Text>
          <SpuLink fontSize="xs" ms="auto" />
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}
