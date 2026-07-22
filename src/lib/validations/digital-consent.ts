import { z } from "zod";

export const digitalConsentSignSchema = z.object({
  token: z.string().trim().min(20).max(256),
  signerName: z.string().trim().min(2).max(160),
  understood: z.preprocess((value) => value === "on" || value === "true", z.literal(true)),
  signatureData: z.string().trim().min(2).max(2000)
});
