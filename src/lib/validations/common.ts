import { z } from "zod";

export const idSchema = z.string().trim().min(1).max(128);

export const secureHttpsUrlSchema = z.string().trim().min(1).max(2048).url().superRefine((value, context) => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Geçerli bir HTTPS adresi girin." });
    return;
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname || (url.port && url.port !== "443")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Geçerli bir HTTPS adresi girin." });
  }
});

export const paginationSchema = z.object({
  query: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25)
});
