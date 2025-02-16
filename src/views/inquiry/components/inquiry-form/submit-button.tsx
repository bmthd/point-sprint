import { Button, ButtonProps, Checkbox, FC, Link, useBoolean } from "@yamada-ui/react";
import { useFormStatus } from "react-dom";

const label = (
  <>
    <Link href="/terms" external>
      利用規約
    </Link>
    に同意する
  </>
);

export const SubmitButton: FC<ButtonProps> = (props) => {
  const { pending } = useFormStatus();
  const [agree, { toggle }] = useBoolean();

  return (
    <>
      <Checkbox label={label} checked={agree} onChange={toggle} />
      <Button type="submit" {...props} loading={pending} disabled={!agree}>
        送信
      </Button>
    </>
  );
};
