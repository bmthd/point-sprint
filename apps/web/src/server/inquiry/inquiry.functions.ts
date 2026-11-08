import { createServerFn } from "@tanstack/react-start";
import type { InquiryResult } from "./inquiry.ts";
import type { InquiryRequest } from "./inquiry-input.ts";

/**
 * The inquiry form's server function, run by the Worker. The input is checked in
 * `handleInquiry`, so that a bad one is answered as a failed stage rather than thrown.
 */
export const submitInquiry = createServerFn({ method: "POST" })
  .validator((data: InquiryRequest) => data)
  .handler(async ({ data }): Promise<InquiryResult> => {
    // Handler imports: see ../../../../../docs/server-imports.md.
    const { handleInquiryInWorker } = await import("./inquiry.worker.ts");
    return handleInquiryInWorker(data);
  });
