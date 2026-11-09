# Campaign Profiles & Detection Configuration

## 1. Overview

The **Campaign Profiles** system replaces hard-coded geographical and carrier assumptions in Fraud Defense Hub with flexible, persistent configurations stored in Firestore (`campaign_profiles` collection) and managed by administrators and analysts.

Campaign profiles allow fraud analysis runs to be configured per region, per partner, and per campaign without altering engine code. When users upload AppsFlyer exports, an automatic single-pass file scan detects country distribution, carriers, and event names to suggest or prefill configuration settings.

---

## 2. Configuration Model (Schema v2)

The `Settings` interface is defined in `src/engine/config.ts`:

```typescript
export interface GeoRule {
  country: string; // ISO 3166-1 alpha-2 uppercase (e.g. "IN", "US")
  knownCarriers: string[]; // Substrings of expected domestic mobile networks
}

export interface FunnelStage {
  label: string; // Human-friendly stage label
  eventNames: string[]; // Event names/aliases belonging to this stage
  optional: boolean; // When true, skipping this stage does not flag fraud
}

export interface Thresholds {
  ctitClickInjectSec: number; // CTIT below which clicks are flagged as injected (default 10s)
  ctitClickFloodDays: number; // CTIT above which clicks are flagged as flood (default 1 day)
  ipFarmThreshold: number; // Same IP occurrences threshold (default 10)
  carrierIpThreshold: number; // Same IP + carrier occurrences threshold (default 10)
  deviceModelClusterThreshold: number; // Model frequency cluster threshold (default 10)
  sdkMismatchMinSample: number; // Minimum source sample to test SDK version mode (default 5)
  timeOfDayThresholdPct: number; // Concentration % in a single hour to flag cluster (default 15%)
  timeOfDayMinSample: number; // Minimum source sample to evaluate time-of-day (default 20)
  uniformTimingMinCount: number; // Min events with identical delta to flag uniform timing (default 5)
  uniformTimingBucketSeconds: number; // Timing delta rounding bucket in seconds (default 5s)
  outdatedOsMaxMajor: {
    android: number | null; // Android major OS version threshold (default 9, null to disable)
    ios: number | null; // iOS major OS version threshold (default 9, null to disable)
  };
}

export interface Settings {
  schemaVersion: 2;
  geos: GeoRule[];
  funnelStages: FunnelStage[];
  timezoneLabel: string;
  thresholds: Thresholds;
  flagZeroedGaid: boolean; // Flag 00000000-0000-0000-0000-000000000000 (default true)
  emulatorKeywords: string[]; // Substrings for emulator detection (default unknown, generic, emulator, sdk)
  buildFlaggedInstalls: boolean;
  buildFlaggedEvents: boolean;
}
```

### Defensive Normalization (`normalizeSettings`)

To ensure backwards compatibility and resilience against partial or legacy inputs:

- Legacy v1 settings (with `targetCountry`, `knownCarriers`, `funnelEvents`, and flat threshold numbers) are automatically migrated to v2 structures.
- Intermediate branch funnel shapes (`{ name, label?, order? }`) are migrated to `{ label, eventNames: [name], optional: false }`.
- Negative or non-numeric values fall back to safe positive defaults.
- Strings are trimmed and sanitized.
- `src/engine/*` has zero external dependencies on React, Firebase, or Zod.

---

## 3. Built-in Profiles

Two immutable built-in profiles are provided across all environments:

1. **`builtin:india-default` — India (Default)**
   - Country: `IN`
   - Domestic Carriers: Jio, Airtel, Vi, Vodafone Idea, Vodafone, Idea, BSNL, MTNL.
   - Conversion Funnel: `af_first_open` &rarr; `af_login` &rarr; `af_purchase`.
   - Timezone: `IST`.
   - Produces byte-for-byte identical output to legacy detection logic.

2. **`builtin:blank` — Blank (Global)**
   - Country restrictions: None (Empty `geos: []`).
   - Funnel stages: None (Empty `funnelStages: []`).
   - Timezone: `UTC`.
   - Useful for worldwide campaigns or exploratory analysis without geographic assumptions.

---

## 4. Detection Logic Updates

### Multi-GEO Validation

- If `geos` is non-empty, every row's `Country Code` is checked against configured rules.
- If a country code is unlisted, the row is flagged with `Geo Mismatch (Country: <CODE>)`.
- If a country code matches a rule with non-empty `knownCarriers`, the row's `Carrier` is verified against the allowed carrier list. Unmatched carriers trigger `Country/Carrier Mismatch (<CARRIER> unexpected for <COUNTRY>)`.
- If `geos` is empty, all countries and carriers are allowed.

### Conversion Funnel Analysis (Model v2)

- Stages are evaluated in array order. Each stage contains a `label` and one or more `eventNames` aliases.
- Aliases are matched case-insensitively. If an alias is mapped to multiple stages, the earlier stage takes precedence.
- If a user triggers an event from stage $N$ without having triggered earlier non-optional stages $0 \dots N-1$, all events for that user are flagged with `Missing Funnel Event: Missing "<earlier_stage_label>" (stage X) but reached "<later_stage_label>" (stage Y)`.
- Stages marked `optional: true` can be skipped by users without triggering fraud signals.

### Platform-Aware Outdated OS

- Rows identify platform (`android` vs `ios`). Unknown platforms fall back to Android rules.
- Android rows are checked against `thresholds.outdatedOsMaxMajor.android` (flagged as `Outdated OS (Android <version>)`).
- iOS rows are checked against `thresholds.outdatedOsMaxMajor.ios` (flagged as `Outdated OS (iOS <version>)`).
- Default thresholds are `{ android: 9, ios: 9 }`, matching the original engine behavior where major OS version &le; 9 was flagged.
- Setting either threshold to `null` disables outdated OS checks for that platform.

### Detection Options

- `flagZeroedGaid: boolean` (default: `true`): When true, rows with `00000000-0000-0000-0000-000000000000` are flagged with `Zeroed GAID (Device Farm/ID Spoof)` and counted in both dashboard and publisher tables. When false, the signal and counters are omitted while GAID reuse checks remain active.
- `emulatorKeywords: string[]`: Configurable list of substrings (default `["unknown", "generic", "emulator", "sdk"]`) used to flag emulator device models.

### Dynamic CTIT Buckets & Labels

- CTIT buckets in Dashboard state dynamically use labels generated by `ctitBucketLabels(settings)`:
  - `Inject (<{ctitClickInjectSec}s)`
  - `Suspicious ({ctitClickInjectSec}s-1m)`
  - `Normal (1m-{ctitClickFloodDays * 24}h)`
  - `Flood (>{ctitClickFloodDays * 24}h)`

---

## 5. File Scan & Worker Session Architecture

1. **Single-Pass File Scan (`scanFile`)**:
   - Inspects headers and data rows in a single pass.
   - Infers mode (`Event` if event names are present, otherwise `Install`).
   - Summarizes top detected countries and domestic carriers.
   - Employs reservoir sampling to estimate median install-to-event time per event.

2. **Worker Session Protocol**:
   - `load`: Reads and parses the file once into worker memory; returns `FileScan`.
   - `run`: Executes detection using selected profile settings on the in-memory data without re-reading the file.
   - `dispose`: Cleans up memory buffers and terminates worker.
   - If Web Workers are unavailable, falls back transparently to main-thread execution.

3. **Profile Suggestion Algorithm (`suggestProfile`)**:
   Pure suggestion logic without hardcoded country rules:
   1. A profile whose associated `appNames` contains the scanned `appName` (case-insensitive, trimmed).
   2. `lastProfileId` if it exists in the active profiles list.
   3. A profile whose `geos` include the scan's top detected country, preferring saved/custom profiles over built-ins.
   4. Fallback to `builtin:blank`.

4. **Run Configuration Dialog (`RunConfigDialog.tsx`)**:
   - Pops up after file scan completes.
   - Surfaces auto-detected characteristics and suggests suitable profiles.
   - Provides a "Use suggested funnel order" action when event data is detected.
   - Allows analysts to choose saved profiles or customize settings inline for a one-off run.
   - Remembers the user's last selected profile across sessions (`farg_last_profile_v1` in `localStorage`).

---

## 6. Access Control & Firestore Rules

Campaign profiles are stored in Firestore under `/campaign_profiles/{profileId}`:

- **Read permission**: Granted to roles with `profiles.view` or `profiles.manage`.
- **Write / Delete permission**: Granted only to roles with `profiles.manage`.
- Built-in profiles cannot be modified or deleted in the UI.
- Firestore Security Rules enforce document shape (`name is string && name.size() > 0 && settings is map`).
