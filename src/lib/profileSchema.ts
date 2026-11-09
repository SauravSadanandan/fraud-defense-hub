import { z } from "zod";

export const geoRuleSchema = z.object({
  country: z
    .string()
    .trim()
    .length(2, "Country code must be 2 letters (e.g. IN, US)")
    .transform((val) => val.toUpperCase()),
  knownCarriers: z.array(z.string().trim().min(1)),
});

export const funnelStageSchema = z.object({
  label: z.string().trim().min(1, "Stage label is required").max(80, "Max 80 characters"),
  eventNames: z
    .array(z.string().trim().min(1, "Event name cannot be empty").max(80, "Max 80 characters"))
    .min(1, "Each stage requires at least one event name")
    .max(10, "Maximum 10 event aliases per stage"),
  optional: z.boolean(),
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
    android: z.coerce.number().int().min(1, "Must be >= 1").nullable(),
    ios: z.coerce.number().int().min(1, "Must be >= 1").nullable(),
  }),
});

export const profileFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(60, "Name must be 60 characters or less"),
  description: z.string().trim().max(200, "Description must be 200 characters or less").optional(),
  appNames: z.array(z.string().trim().min(1).max(100)),
  timezoneLabel: z.string().trim().min(1, "Timezone label is required").max(20),
  geos: z.array(geoRuleSchema),
  funnelStages: z.array(funnelStageSchema).max(30, "Maximum 30 funnel stages"),
  thresholds: thresholdsSchema,
  flagZeroedGaid: z.boolean(),
  emulatorKeywords: z
    .array(z.string().trim().min(1).max(40))
    .max(30, "Maximum 30 emulator keywords"),
  buildFlaggedInstalls: z.boolean(),
  buildFlaggedEvents: z.boolean(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
