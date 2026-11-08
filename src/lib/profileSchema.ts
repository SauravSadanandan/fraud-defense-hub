import { z } from "zod";

export const geoRuleSchema = z.object({
  country: z
    .string()
    .trim()
    .length(2, "Country code must be 2 letters (e.g. IN, US)")
    .transform((val) => val.toUpperCase()),
  knownCarriers: z.array(z.string().trim().min(1)).default([]),
});

export const funnelStageSchema = z.object({
  name: z.string().trim().min(1, "Event name is required"),
  label: z.string().trim().optional(),
  order: z.number().int().min(0),
});

export const thresholdsSchema = z.object({
  ctitClickInjectSec: z.coerce.number().min(1, "Must be at least 1s"),
  ctitClickFloodDays: z.coerce.number().min(1, "Must be at least 1 day"),
  ipFarmThreshold: z.coerce.number().min(1, "Must be at least 1"),
  carrierIpThreshold: z.coerce.number().min(1, "Must be at least 1"),
  deviceModelClusterThreshold: z.coerce.number().min(1, "Must be at least 1"),
  sdkMismatchMinSample: z.coerce.number().min(1, "Must be at least 1"),
  timeOfDayThresholdPct: z.coerce.number().min(1).max(100, "Percentage must be 1-100"),
  timeOfDayMinSample: z.coerce.number().min(1, "Must be at least 1"),
  uniformTimingMinCount: z.coerce.number().min(1, "Must be at least 1"),
  uniformTimingBucketSeconds: z.coerce.number().min(1, "Must be at least 1s"),
  outdatedOsMaxMajor: z.object({
    android: z.coerce.number().min(1, "Must be >= 1"),
    ios: z.coerce.number().min(1, "Must be >= 1"),
  }),
});

export const profileFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(60, "Name must be 60 characters or less"),
  description: z.string().trim().max(200, "Description must be 200 characters or less").optional(),
  timezoneLabel: z.string().trim().min(1, "Timezone label is required").max(20),
  geos: z.array(geoRuleSchema).default([]),
  funnelStages: z.array(funnelStageSchema).default([]),
  thresholds: thresholdsSchema,
  buildFlaggedInstalls: z.boolean().default(true),
  buildFlaggedEvents: z.boolean().default(true),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
