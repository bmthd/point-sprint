// The parts of the Workers runtime modules the server function uses. The plugin's generated types
// (`.cloudflare/types`) exist only after a dev server or a build has run.

declare module "cloudflare:workers" {
  /** The bindings in `cloudflare.config.ts`. A secret without a value is left out. */
  export const env: {
    TURNSTILE_SECRET_KEY?: string;
    INQUIRY_TO_ADDRESS?: string;
    INQUIRY_EMAIL?: { send(message: import("cloudflare:email").EmailMessage): Promise<unknown> };
  };
}

declare module "cloudflare:email" {
  export class EmailMessage {
    constructor(from: string, to: string, raw: string | ReadableStream);
    readonly from: string;
    readonly to: string;
  }
}
