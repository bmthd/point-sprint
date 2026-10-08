import { type Benefit, type CalculationResult, type Plan, channels } from "@workspaces/domain";
import {
  Badge,
  type BadgeProps,
  Box,
  Button,
  Card,
  CheckboxCard,
  Image,
  Link,
  Modal,
  Text,
  useDisclosure,
} from "@workspaces/ui";
import { useSetAtom } from "jotai";
import { useId, useState } from "react";
import { toggleBenefitAtom } from "../../../state/order-ops";
import { ExternalIcon } from "../../../ui/icons";
import { pointsText, rateText } from "../-order-shared";
import { imageUrl, SPU_PAGE_URL, useSaveSettingsChange } from "./settings-shared";

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

const enabledRate = (plan: Plan, category: Benefit["category"]) =>
  plan.benefits.reduce(
    (sum, benefit) =>
      benefit.kind === "rate-bonus" && benefit.category === category && benefit.enabled
        ? sum + benefit.params.rate
        : sum,
    0,
  );

/** The sum of the rates of the SPU (category `spu`) that are on. */
export const spuRate = (plan: Plan) => enabledRate(plan, "spu");

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
    day: "1日の上限",
  }[benefit.capScope];
  return `${scope} ${pointsText(cap)}`;
}

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
    <Box display="flex" flexDirection="column" alignItems="center" gap="1" minW="0">
      <CheckboxCard.Root
        checked={on}
        onChange={onToggle}
        colorScheme="primary"
        size="sm"
        withIndicator={false}
        aspectRatio="1"
        maxW="76px"
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
      {/* Long names (楽天プレミアムカード（特典分）) wrap instead of overflowing the column. */}
      <Button
        variant="ghost"
        size="xs"
        onClick={onDetail}
        aria-label={`${name}の上限と条件`}
        w="full"
        h="auto"
        minH="8"
        py="1"
        whiteSpace="normal"
        lineHeight="moderate"
      >
        {name}
      </Button>
    </Box>
  );
}

/** 「上限」: the SPU reached its cap in this plan. */
function CapBadge(props: BadgeProps) {
  return (
    <Badge colorScheme="primary" variant="solid" fullRounded {...props}>
      上限
    </Badge>
  );
}

function SpuLink() {
  return (
    <Link href={SPU_PAGE_URL} target="_blank" rel="noreferrer" alignSelf="flex-start" gap="1.5">
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
  return (
    <Box display="flex" flexDirection="column" gap="2" fontSize="sm">
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
      <Text color="fg.muted">達成の条件は楽天のページで確かめて、達成したものを ON にします。</Text>
      <SpuLink />
    </Box>
  );
}

/**
 * The SPU tiles with the detail dialog behind each name. Works on any list of benefits: a plan's,
 * or the profile's defaults. `capped` holds the ids that reached their cap (none for a profile).
 */
export function SpuTileGrid({
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
        <Box
          role="group"
          aria-label="SPU のサービス"
          display="grid"
          gridTemplateColumns="repeat(4, minmax(0, 1fr))"
          columnGap="1.5"
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
        </Box>
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

/** The SPU section: the total, the tiles and their legend. */
export function SpuTiles({ plan, result }: { plan: Plan; result: CalculationResult }) {
  const toggle = useSetAtom(toggleBenefitAtom);
  const save = useSaveSettingsChange(plan.id);
  const capped = new Set(
    result.benefitTotals.filter((total) => total.capReached).map((total) => total.benefitId),
  );
  const normal = enabledRate(plan, "base");
  const spu = spuRate(plan);

  return (
    <Card.Root as="section" aria-label="SPU">
      <Card.Body alignItems="stretch">
        <Box display="flex" alignItems="flex-end" justifyContent="space-between" gap="3">
          <Box>
            <Text fontSize="xs" color="fg.muted">
              SPU を入れて全商品
            </Text>
            <Text
              fontSize="4xl"
              fontWeight="bold"
              lineHeight="1.1"
              fontVariantNumeric="tabular-nums"
            >
              {num(normal + spu)}
              <Text as="span" fontSize="md" fontWeight="medium">
                倍
              </Text>
            </Text>
          </Box>
          <Text fontSize="xs" color="fg.muted" textAlign="end" fontVariantNumeric="tabular-nums">
            通常 {num(normal)}倍 ＋ SPU{" "}
            <Text as="b" color="fg">
              +{num(spu)}倍
            </Text>
            <br />
            タップで ON / OFF
          </Text>
        </Box>

        <SpuTileGrid
          benefits={plan.benefits}
          capped={capped}
          onToggle={(benefitId) => save(toggle({ planId: plan.id, benefitId }))}
        />

        <Box
          display="flex"
          flexWrap="wrap"
          alignItems="center"
          columnGap="3"
          rowGap="1.5"
          fontSize="xs"
          color="fg.muted"
        >
          <Box as="span" display="inline-flex" alignItems="center" gap="1">
            <Box
              as="span"
              boxSize="3"
              rounded="sm"
              bg="primary.subtle"
              borderWidth="1px"
              borderColor="primary.muted"
            />
            ON
          </Box>
          <Box as="span" display="inline-flex" alignItems="center" gap="1">
            <Box as="span" boxSize="3" rounded="sm" borderWidth="1px" borderColor="border" />
            OFF
          </Box>
          <Box as="span" display="inline-flex" alignItems="center" gap="1">
            <CapBadge as="span" />
            このプランで上限に達した
          </Box>
          <Box as="span" ms="auto">
            名前を押すと上限・条件
          </Box>
        </Box>
        <SpuLink />
      </Card.Body>
    </Card.Root>
  );
}
