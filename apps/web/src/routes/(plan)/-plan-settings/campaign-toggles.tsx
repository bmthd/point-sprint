import {
  type Benefit,
  type Plan,
  campaignTemplates,
  comesWithPlan,
  isTwoShopCampaign,
  templateOfCampaign,
} from "@workspaces/domain";
import { Box, Card, Flex, Heading, IconButton, Image, List, Switch, Text } from "@workspaces/ui";
import { useSetAtom } from "jotai";
import { useId, useRef, useState } from "react";
import { rateText } from "../../../ui/format";
import { toggleBenefitAtom } from "../../../state/plan-operations";
import { PencilIcon } from "../../../ui/icons";
import { imageUrl } from "../-order-shared";
import { CampaignAddButtons } from "./campaign-adder";
import { CampaignEditor } from "./campaign-editor";
import { useDeleteCampaign } from "./delete-campaign";
import { useSaveSettingsChange, whenText } from "./settings-shared";

const fixedKeys = new Set(
  campaignTemplates.filter(comesWithPlan).map((template) => template.benefit.sharedKey),
);

const fixedDayKeys = new Set(
  campaignTemplates
    .filter((template) => template.occurrence === "fixed")
    .map((template) => template.benefit.sharedKey),
);

/** Whether the campaign's days are set by its date rule (5と0のつく日, ワンダフルデー). */
export const isFixedCampaign = (benefit: Benefit) =>
  benefit.sharedKey !== undefined && fixedDayKeys.has(benefit.sharedKey);

/**
 * Whether the user added this campaign themselves, so it can be deleted. Fixed campaigns (days
 * ending in 5 or 0) and the official event's benefits come with the plan.
 */
export function isAddedCampaign(plan: Plan, benefit: Benefit) {
  // The event's benefits share its id as their key (`sharedKey`).
  if (benefit.sharedKey === undefined) return true;
  return benefit.sharedKey !== plan.officialEventId && !fixedKeys.has(benefit.sharedKey);
}

/**
 * The plan's campaigns that are toggled here: every campaign of one rate, a 2ショップ購入, and a
 * fixed campaign set by its total (ワンダフルデー). The shop-around and the other campaigns set by
 * their total have their own cards.
 */
const campaignsOf = (plan: Plan) =>
  plan.benefits.filter(
    (benefit) =>
      benefit.category === "campaign" &&
      (benefit.kind === "rate-bonus" ||
        isTwoShopCampaign(benefit) ||
        (benefit.kind === "spend-tiers" && isFixedCampaign(benefit))),
  );

/** The +N倍 a campaign's row shows: its rate, or the highest of its tiers. */
const rateOf = (benefit: Benefit) =>
  benefit.kind === "rate-bonus"
    ? benefit.params.rate
    : Math.max(...benefit.params.tiers.map((tier) => tier.rate));

/**
 * One campaign: its image, name, rate and days, then ✎ for one the user added, then whether it
 * is on and its switch. The ✎ keeps its place on every row, so the switches line up.
 */
function CampaignRow({
  plan,
  benefit,
  editing,
  onEdit,
  onToggle,
  onDelete,
}: {
  plan: Plan;
  benefit: Benefit;
  editing: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const when = whenText(benefit.conditions.dateRule);
  const name = `${benefit.label} ${rateText(rateOf(benefit))} ${when}`;
  const template = isAddedCampaign(plan, benefit) ? templateOfCampaign(benefit) : undefined;
  const editorId = useId();
  return (
    <List.Item display="flex" flexDirection="column" gap="2">
      <Flex align="center" gap="2" minH="12">
        <Flex flex="1" align="center" gap="2" minW="0">
          {benefit.imagePath ? (
            <Image
              src={imageUrl(benefit.imagePath)}
              alt={benefit.label}
              boxSize="10"
              objectFit="contain"
              flexShrink="0"
            />
          ) : (
            <Box boxSize="10" flexShrink="0" />
          )}
          <Flex direction="column" minW="0">
            <Text as="span" fontWeight="medium">
              {benefit.label}{" "}
              <Text as="span" fontVariantNumeric="tabular-nums">
                {rateText(rateOf(benefit))}
              </Text>
            </Text>
            <Text as="span" fontSize="sm" color="fg.muted" fontVariantNumeric="tabular-nums">
              {when}
            </Text>
          </Flex>
        </Flex>
        <Box boxSize="11" flexShrink="0">
          {template ? (
            <IconButton
              variant={editing ? "subtle" : "ghost"}
              colorScheme={editing ? "primary" : undefined}
              aria-label={`${benefit.label}を編集`}
              aria-expanded={editing}
              aria-controls={editing ? editorId : undefined}
              onClick={onEdit}
            >
              <PencilIcon />
            </IconButton>
          ) : null}
        </Box>
        <Text
          as="span"
          w="7"
          flexShrink="0"
          textAlign="end"
          fontSize="sm"
          fontWeight="medium"
          color={benefit.enabled ? "primary.fg" : "fg.muted"}
        >
          {benefit.enabled ? "ON" : "OFF"}
        </Text>
        <Switch
          checked={benefit.enabled}
          onChange={onToggle}
          colorScheme="primary"
          size="md"
          flexShrink="0"
          inputProps={{ "aria-label": name }}
        />
      </Flex>
      {editing && template ? (
        <CampaignEditor
          id={editorId}
          plan={plan}
          benefit={benefit}
          template={template}
          onDelete={onDelete}
        />
      ) : null}
    </List.Item>
  );
}

/**
 * The campaigns with their switches, and a button for each template that adds it at once. A campaign
 * just added opens its values, to be changed there.
 */
export function CampaignToggles({ plan }: { plan: Plan }) {
  const toggle = useSetAtom(toggleBenefitAtom);
  const save = useSaveSettingsChange(plan.id);
  const [editingId, setEditingId] = useState<string>();
  const addRef = useRef<HTMLButtonElement>(null);
  const deletion = useDeleteCampaign(plan, addRef);
  const campaigns = campaignsOf(plan);

  return (
    <Card.Root as="section" aria-label="キャンペーン">
      <Card.Body alignItems="stretch" gap="4">
        <Flex align="center" justify="space-between" gap="2">
          <Heading as="h2" fontSize="md">
            キャンペーン
          </Heading>
          <Text fontSize="xs" color="fg.muted">
            エントリーしたものを ON に
          </Text>
        </Flex>
        {campaigns.length > 0 ? (
          <List.Root gap="2">
            {campaigns.map((benefit) => (
              <CampaignRow
                key={benefit.id}
                plan={plan}
                benefit={benefit}
                editing={editingId === benefit.id}
                onEdit={() => setEditingId(editingId === benefit.id ? undefined : benefit.id)}
                onToggle={() => save(toggle({ planId: plan.id, benefitId: benefit.id }))}
                onDelete={() => deletion.ask(benefit)}
              />
            ))}
          </List.Root>
        ) : null}
        <CampaignAddButtons
          plan={plan}
          firstRef={addRef}
          onAdded={(benefit) => setEditingId(benefit.id)}
        />
        {deletion.dialog}
      </Card.Body>
    </Card.Root>
  );
}
