import { createServerFn } from "@tanstack/react-start";
import type { InquiryResult } from "./inquiry";
import type { InquiryRequest } from "./inquiry-input";

/**
 * The inquiry form's server function, run by the Worker. The input is checked in
 * `handleInquiry`, so that a bad one is answered as a failed stage rather than thrown.
 */
export const submitInquiry = createServerFn({ method: "POST" })
  .validator((data: InquiryRequest) => data)
  .handler(async ({ data }): Promise<InquiryResult> => {
    // Loaded here: it imports the Workers runtime, which tests that import this module lack.
    const { handleInquiryInWorker } = await import("./worker-inquiry");
    return handleInquiryInWorker(data);
  });
