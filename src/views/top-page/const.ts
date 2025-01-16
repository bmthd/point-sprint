export const TAX_RATE = [1.1, 1.08, 1] as const;

export type TaxRate = (typeof TAX_RATE)[number];

export const taxRateMap = [
  { label: "10%", value: 1.1 },
  { label: "8%", value: 1.08 },
  { label: "非課税", value: 1 },
] as const satisfies { label: string; value: TaxRate }[];
