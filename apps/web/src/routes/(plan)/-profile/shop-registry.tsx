import { type Shop, channels } from "@workspaces/domain";
import { Box, Flex, Card, Switch, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { CommitField } from "../../../form/commit-field";
import { ShopNameSchema } from "../../../form/field-schemas";
import { changeShop, saveShopAtom } from "../../../state/mutations";
import { shopsAtom } from "../../../state/queries";
import { withTag } from "../-order-fields";

const is39 = (shop: Shop) => shop.tags.includes("39shop");

function ShopRow({
  shop,
  onSave,
}: {
  shop: Shop;
  /** Saves a change, applied to the shop as it is when it is saved. */
  onSave: (change: (shop: Shop) => Shop) => Promise<unknown>;
}) {
  return (
    <Flex
      as="li"
      direction="column"
      gap="1"
      py="2.5"
      borderTopWidth="1px"
      borderColor="border"
      _first={{ borderTopWidth: "0" }}
    >
      <CommitField
        key={shop.name}
        label={`${shop.name}の名前`}
        hideLabel
        initial={shop.name}
        schema={ShopNameSchema}
        onCommit={(name) => onSave((current) => ({ ...current, name }))}
      />
      <Flex align="center" justify="space-between" gap="3">
        <Text fontSize="xs" color="fg.muted" minW="0" overflowWrap="anywhere">
          購入先 {channels[shop.channel].label}
          <br />
          ショップコード {shop.shopCode ?? "なし"}
        </Text>
        <Switch
          colorScheme="primary"
          reverse
          flex="none"
          inputProps={{ "aria-label": `${shop.name} 39ショップ` }}
          checked={is39(shop)}
          onChange={(event) => {
            const on = event.currentTarget.checked;
            void onSave((current) => ({ ...current, tags: withTag(current.tags, "39shop", on) }));
          }}
        >
          39ショップ
        </Switch>
      </Flex>
    </Flex>
  );
}

/** The shop registry: every shop with its channel and shop code, and its name and 39ショップ mark editable. */
export function ShopRegistry({ onFailed }: { onFailed: (failed: boolean) => void }) {
  const shops = useAtomValue(shopsAtom);
  const { mutateAsync: saveShop } = useAtomValue(saveShopAtom);
  const sorted = [...shops].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const save = (shopId: string, change: (shop: Shop) => Shop) => {
    onFailed(false);
    const saving = saveShop(changeShop(shopId, change));
    saving.catch(() => onFailed(true));
    return saving;
  };
  return (
    <Card.Root as="section" aria-labelledby="shop-registry-title">
      <Card.Body alignItems="stretch">
        <Text as="h2" id="shop-registry-title" fontSize="md" fontWeight="bold">
          ショップ台帳
        </Text>
        <Text fontSize="xs" color="fg.muted">
          注文で入力したショップがここに並びます。名前と39ショップかどうかを直せます。
        </Text>
        {sorted.length > 0 ? (
          <Box as="ul" aria-label="ショップ台帳" listStyleType="none" m="0" p="0">
            {sorted.map((shop) => (
              <ShopRow key={shop.id} shop={shop} onSave={(change) => save(shop.id, change)} />
            ))}
          </Box>
        ) : (
          <Text fontSize="sm" color="fg.muted">
            まだショップがありません。
          </Text>
        )}
      </Card.Body>
    </Card.Root>
  );
}
