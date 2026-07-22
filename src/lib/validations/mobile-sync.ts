import { z } from "zod";

export const mobileSyncOperationSchema = z.object({
  operationId: z.string().min(8).max(128),
  entityType: z.enum(["PATIENT", "APPOINTMENT", "PAYMENT", "TREATMENT_PLAN", "TREATMENT", "STOCK_ITEM", "STOCK_MOVEMENT", "STOCK_OFFER", "STOCK_RECIPE", "DOCTOR", "STAFF", "CONSENT", "SURVEY", "SURVEY_RESPONSE", "COMMUNICATION", "RECALL", "LEAD", "CLINIC_CONFIG"]),
  action: z.enum(["CREATE", "UPDATE", "DELETE"]),
  clientId: z.string().min(1).max(128),
  createdAt: z.string().datetime(),
  payload: z.record(z.unknown())
});

export const mobileSyncBatchSchema = z.object({
  deviceId: z.string().min(8).max(128),
  operations: z.array(mobileSyncOperationSchema).max(50)
});

export type MobileSyncOperation = z.infer<typeof mobileSyncOperationSchema>;
export type MobileSyncBatch = z.infer<typeof mobileSyncBatchSchema>;
