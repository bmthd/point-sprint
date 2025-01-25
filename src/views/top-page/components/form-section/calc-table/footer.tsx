import { ConfirmDialog } from "@/ui/dialog";
import { type Operation } from "@/ui/table";
import { useTotalPrice } from "@/views/top-page/store";
import { FieldMetadata } from "@conform-to/react";
import { ListPlusIcon, MinusIcon, PlusIcon, RotateCcwIcon } from "@yamada-ui/lucide";
import {
  Button,
  ButtonGroup,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Text,
} from "@yamada-ui/react";
import { type HeaderContext } from "@yamada-ui/table";
import { ComponentRef, FC, useCallback, useRef } from "react";
import { initializeItem, Item } from "../../../schema/storage";

type HeaderComponent<T = Item> = FC<HeaderContext<FieldMetadata<T>, Operation<T>>>;

/** 行追加ボタン */
export const AddRowButton: HeaderComponent = ({ table }) => {
  const handleClick = useCallback(() => table.options.meta?.add?.(initializeItem()), [table]);
  return (
    <Button onClick={handleClick} startIcon={<ListPlusIcon fontSize="2xl" />} w="full">
      行追加
    </Button>
  );
};

/** 合計金額表示 */
export const TotalPriceDisplay: FC = () => {
  const total = useTotalPrice();
  return (
    <InputGroup>
      <InputLeftElement>合計</InputLeftElement>
      <Input type="number" value={total} readOnly />
      <InputRightElement>円</InputRightElement>
    </InputGroup>
  );
};

/** 合計ポイント表示 */
export const TotalPointDisplay: HeaderComponent = ({ table }) => {
  // const total = useMemo(() => {
  //   const data = table.options.data;
  //   return data.reduce((acc, row) => {
  //     const field = row.getFieldset();
  //     return acc + 0;
  //   }, 0);
  // }, [table]);
  const total = 0;
  return (
    <InputGroup>
      <InputLeftElement>合計</InputLeftElement>
      <Input value={total} readOnly />
    </InputGroup>
  );
};

/** 追加還元率一括増減ボタン */
export const AddAdditionalRateButton: HeaderComponent = ({ table }) => {
  // const handleClick = useCallback(() => table.options.meta?.add?.(), [table]);
  // return <IconButton onClick={handleClick} icon={<ListPlusIcon />} />;
  return (
    <ButtonGroup attached flexDirection="column" w="full" bg="white">
      <IconButton icon={<PlusIcon />} h="min-content" />
      <IconButton icon={<MinusIcon />} h="min-content" />
    </ButtonGroup>
  );
};

export const ResetButton: HeaderComponent = ({ table }) => {
  const dialogRef = useRef<ComponentRef<typeof ConfirmDialog>>(null);
  const handleClick = useCallback(async () => {
    const isConfirm = await dialogRef.current?.confirm();
    if (!isConfirm) return;
    table.options.meta?.reset?.();
  }, []);
  return (
    <>
      <Button onClick={handleClick} startIcon={<RotateCcwIcon />} colorScheme="danger">
        リセット
      </Button>
      <ConfirmDialog ref={dialogRef} cancelText="キャンセル">
        <Text>テーブルのすべての入力値を初期化します。</Text>
        <Text color="red">この操作は取り消せません。</Text>
        <Text>よろしいですか？</Text>
      </ConfirmDialog>
    </>
  );
};
