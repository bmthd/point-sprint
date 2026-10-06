import { type Shop, channels } from "@workspaces/domain";
import { Box, Card, Input, Switch, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { changeShop, saveShopAtom } from "../../state/mutations";
import { shopsAtom } from "../../state/queries";
import { withTag } from "../plan-home/order-fields";

const is39 = (shop: Shop) => shop.tags.includes("39shop");

function ShopRow({
  shop,
  onSave,
}: {
  shop: Shop;
  /** Saves a change, applied to the shop as it is when it is saved. */
  onSave: (change: (shop: Shop) => Shop) => void;
}) {
  const [draft, setDraft] = useState<string>();
  const name = draft ?? shop.name;
  const commit = () => {
    const next = name.trim();
    setDraft(undefined);
    if (next !== "" && next !== shop.name) onSave((current) => ({ ...current, name: next }));
  };
  return (
    <Box
      as="li"
      display="flex"
      flexDirection="column"
      gap="1"
      py="2.5"
      borderTopWidth="1px"
      borderColor="border"
      _first={{ borderTopWidth: "0" }}
    >
      <Input
        size="lg"
        aria-label={`${shop.name}の名前`}
        value={name}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(undefined);
        }}
      />
      <Box display="flex" alignItems="center" justifyContent="space-between" gap="3">
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
            onSave((current) => ({ ...current, tags: withTag(current.tags, "39shop", on) }));
          }}
        >
          39ショップ
        </Switch>
      </Box>
    </Box>
  );
}

/** The shop registry: every shop with its channel and shop code, and its name and 39ショップ mark editable. */
export function ShopRegistry({ onFailed }: { onFailed: (failed: boolean) => void }) {
  const shops = useAtomValue(shopsAtom);
  const { mutateAsync: saveShop } = useAtomValue(saveShopAtom);
  const sorted = [...shops].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const save = (shopId: string, change: (shop: Shop) => Shop) => {
    onFailed(false);
    saveShop(changeShop(shopId, change)).catch(() => onFailed(true));
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
