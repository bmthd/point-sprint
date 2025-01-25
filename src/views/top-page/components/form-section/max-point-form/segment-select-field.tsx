import { NumberField } from "@/ui/form";
import { SPUEventInput } from "@/views/top-page/schema/storage";
import { FieldMetadata } from "@conform-to/react";
import { SegmentedControl, SegmentedControlItem } from "@yamada-ui/react";
import { FC, useCallback, useRef } from "react";
import { useSaveFormData } from "../save";

const items: SegmentedControlItem[] = [
  { label: "スーパーセール", value: "7000" },
  { label: "お買い物マラソン", value: "5000" },
];

export const SegmentSelectField: FC<{ field: FieldMetadata<SPUEventInput["maxPoint"]> }> = ({
  field,
}) => {
  const ref = useRef<HTMLInputElement>(null);

  const save = useSaveFormData();

  const handleSegmentChange = useCallback((value: string) => {
    if (!ref.current) return;
    ref.current.value = value;
  }, []);

  const handleInputChange = useCallback(() => {
    if (!ref.current) return;
    save({ node: ref.current });
  }, [save]);

  return (
    <>
      <SegmentedControl items={items} onChange={handleSegmentChange} name={""}></SegmentedControl>
      <NumberField
        ref={ref}
        name={field.name}
        onChange={handleInputChange}
        label="買い回り還元上限"
        stepper={false}
      />
    </>
  );
};
