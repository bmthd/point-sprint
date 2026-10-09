import {
  type Benefit,
  type CampaignTemplate,
  type Plan,
  campaignTemplates,
  officialEvents,
} from "@workspaces/domain";
import {
  Box,
  Button,
  Card,
  CheckboxCard,
  HStack,
  Heading,
  IconButton,
  Image,
  Text,
  VStack,
} from "@workspaces/ui";
import { useSetAtom } from "jotai";
import { useRef, useState } from "react";
import { toggleBenefitAtom } from "../../../state/order-ops";
import { CloseIcon } from "../../../ui/icons";
import { rateText } from "../-order-shared";
import { CampaignAddDialog, TemplateList } from "./campaign-adder";
import { useDeleteCampaign } from "./delete-campaign";
import { imageUrl, useSaveSettingsChange, whenText } from "./settings-shared";

type RateBenefit = Extract<Benefit, { kind: "rate-bonus" }>;

const fixedKeys = new Set(
  campaignTemplates
    .filter((template) => template.occurrence === "fixed")
    .map((template) => template.benefit.sharedKey),
);

/**
 * Whether the user added this campaign themselves, so it can be deleted. Fixed campaigns (days
 * ending in 5 or 0) and the official event's benefits come with the plan.
 */
export function isAddedCampaign(plan: Plan, benefit: Benefit) {
  const event = officialEvents.find((candidate) => candidate.id === plan.officialEventId);
  if (event?.benefits.some((eventBenefit) => eventBenefit.id === benefit.id)) return false;
  return benefit.sharedKey === undefined || !fixedKeys.has(benefit.sharedKey);
}

/** The plan's campaigns that are toggled here: every campaign but the shop-around. */
const campaignsOf = (plan: Plan) =>
  plan.benefits.filter(
    (benefit): benefit is RateBenefit =>
      benefit.category === "campaign" && benefit.kind === "rate-bonus",
  );

function CampaignToggle({ benefit, onToggle }: { benefit: RateBenefit; onToggle: () => void }) {
  const when = whenText(benefit.conditions.dateRule);
  return (
    <CheckboxCard.Root
      checked={benefit.enabled}
      onChange={onToggle}
      colorScheme="primary"
      size="sm"
      w="auto"
      inputProps={{ "aria-label": `${benefit.label} ${rateText(benefit.params.rate)} ${when}` }}
    >
      <HStack as="span" gap="2">
        {benefit.imagePath ? (
          <Image
            src={imageUrl(benefit.imagePath)}
            alt={benefit.label}
            boxSize="10"
            objectFit="contain"
            flexShrink="0"
          />
        ) : null}
        <VStack as="span" gap="0">
          <CheckboxCard.Label>
            {benefit.label}{" "}
            <Text as="span" fontVariantNumeric="tabular-nums">
              {rateText(benefit.params.rate)}
            </Text>
          </CheckboxCard.Label>
          <CheckboxCard.Description fontVariantNumeric="tabular-nums">
            {when}
          </CheckboxCard.Description>
        </VStack>
      </HStack>
    </CheckboxCard.Root>
  );
}

/** The campaigns as toggles, 「＋ 追加」 and its templates. */
export function CampaignToggles({ plan }: { plan: Plan }) {
  const toggle = useSetAtom(toggleBenefitAtom);
  const save = useSaveSettingsChange(plan.id);
  const [addOpen, setAddOpen] = useState(false);
  const [template, setTemplate] = useState<CampaignTemplate>();
  const addRef = useRef<HTMLButtonElement>(null);
  const deletion = useDeleteCampaign(plan, addRef);
  const campaigns = campaignsOf(plan);

  return (
    <Card.Root as="section" aria-label="キャンペーン">
      <Card.Body alignItems="stretch">
        <Box display="flex" alignItems="center" justifyContent="space-between" gap="2">
          <Heading as="h2" fontSize="md">
            キャンペーン
          </Heading>
          <Text fontSize="xs" color="fg.muted">
            エントリーしたものを ON に
          </Text>
        </Box>
        <Box display="flex" flexWrap="wrap" gap="2">
          {campaigns.map((benefit) => (
            <Box key={benefit.id} display="flex" alignItems="stretch" gap="0.5">
              <CampaignToggle
                benefit={benefit}
                onToggle={() => save(toggle({ planId: plan.id, benefitId: benefit.id }))}
              />
              {isAddedCampaign(plan, benefit) ? (
                <IconButton
                  variant="ghost"
                  aria-label={`${benefit.label}を削除`}
                  onClick={() => deletion.ask(benefit)}
                  alignSelf="center"
                >
                  <CloseIcon />
                </IconButton>
              ) : null}
            </Box>
          ))}
          <Button
            ref={addRef}
            variant="outline"
            colorScheme="primary"
            aria-expanded={addOpen}
            onClick={() => setAddOpen((open) => !open)}
            alignSelf="center"
          >
            ＋ 追加
          </Button>
        </Box>
        {addOpen ? <TemplateList onPick={setTemplate} /> : null}

        <CampaignAddDialog plan={plan} template={template} onClose={() => setTemplate(undefined)} />
        {deletion.dialog}
      </Card.Body>
    </Card.Root>
  );
}
