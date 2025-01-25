"use client";

import { JSONViewer } from "@/ui/dev/json-viewer";
import { useFormMetadata } from "@conform-to/react";
import { FC } from "react";

const DebugComponent: FC = () => {
  const form = useFormMetadata();
  return (
    <JSONViewer
      value={{
        formValue: form.value,
        formErrors: form.allErrors,
      }}
    />
  );
};

export default DebugComponent;
