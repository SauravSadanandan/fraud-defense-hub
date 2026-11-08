import { COL } from "../../src/engine/config";

// Deterministic Mulberry32 PRNG
export function createRng(seed = 42) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FIXTURE_HEADERS: string[] = [
  COL.TOUCH_TYPE,
  COL.TOUCH_TIME,
  COL.INSTALL_TIME,
  COL.EVENT_TIME,
  COL.EVENT_NAME,
  COL.PARTNER,
  COL.MEDIA_SOURCE,
  COL.CHANNEL,
  COL.CAMPAIGN,
  COL.SITE_ID,
  COL.REGION,
  COL.COUNTRY,
  COL.STATE,
  COL.CITY,
  COL.IP,
  COL.CARRIER,
  COL.APPSFLYER_ID,
  COL.ADVERTISING_ID,
  COL.ANDROID_ID,
  COL.IDFA,
  COL.DEVICE_CATEGORY,
  COL.PLATFORM,
  COL.OS_VERSION,
  COL.APP_VERSION,
  COL.SDK_VERSION,
  COL.IS_PRIMARY,
  COL.DEVICE_MODEL,
  COL.FRAUD_REASON,
  COL.FRAUD_SUB,
  COL.DETECTION_DATE,
  COL.APP_NAME,
];

interface RowBuilderOptions {
  touchType?: string;
  touchTime?: string;
  installTime?: string;
  eventTime?: string;
  eventName?: string;
  partner?: string;
  mediaSource?: string;
  channel?: string;
  campaign?: string;
  siteId?: string;
  region?: string;
  country?: string;
  state?: string;
  city?: string;
  ip?: string;
  carrier?: string;
  appsflyerId?: string;
  advertisingId?: string;
  androidId?: string;
  idfa?: string;
  deviceCategory?: string;
  platform?: string;
  osVersion?: string;
  appVersion?: string;
  sdkVersion?: string;
  isPrimary?: string;
  deviceModel?: string;
  fraudReason?: string;
  fraudSub?: string;
  detectionDate?: string;
  appName?: string;
}

function buildRow(opts: RowBuilderOptions): unknown[] {
  return [
    opts.touchType ?? "click",
    opts.touchTime ?? "",
    opts.installTime ?? "",
    opts.eventTime ?? "",
    opts.eventName ?? "",
    opts.partner ?? "",
    opts.mediaSource ?? "organic",
    opts.channel ?? "",
    opts.campaign ?? "campaign_test",
    opts.siteId ?? "site_1",
    opts.region ?? "APAC",
    opts.country ?? "IN",
    opts.state ?? "MH",
    opts.city ?? "Mumbai",
    opts.ip ?? "49.32.1.1",
    opts.carrier ?? "Jio",
    opts.appsflyerId ?? "af_id_0",
    opts.advertisingId ?? "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    opts.androidId ?? "android_id_0",
    opts.idfa ?? "",
    opts.deviceCategory ?? "phone",
    opts.platform ?? "android",
    opts.osVersion ?? "13",
    opts.appVersion ?? "1.0.0",
    opts.sdkVersion ?? "6.12.0",
    opts.isPrimary ?? "true",
    opts.deviceModel ?? "Samsung SM-S911B",
    opts.fraudReason ?? "",
    opts.fraudSub ?? "",
    opts.detectionDate ?? "2025-01-10",
    opts.appName ?? "TestApp",
  ];
}

function formatUtc(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const min = pad(d.getUTCMinutes());
  const s = pad(d.getUTCSeconds());
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

export function generateInstallRows(seed = 42): { headers: string[]; rows: unknown[][] } {
  const rng = createRng(seed);
  const rows: unknown[][] = [];
  const baseTime = Date.UTC(2025, 0, 10, 10, 0, 0); // 2025-01-10 10:00:00 UTC

  // 1. Click Injection (CTIT < 10s) — 15 rows
  for (let i = 0; i < 15; i++) {
    const touchMs = baseTime + i * 60000;
    const deltaS = 2 + Math.floor(rng() * 7); // 2..8 sec
    rows.push(
      buildRow({
        appsflyerId: `af_inj_${i}`,
        mediaSource: "source_inj",
        touchTime: formatUtc(touchMs),
        installTime: formatUtc(touchMs + deltaS * 1000),
        ip: `110.22.1.${i}`,
        advertisingId: `inj-gaid-${i}`,
      }),
    );
  }

  // 2. Click Flooding (CTIT > 1d) — 15 rows
  for (let i = 0; i < 15; i++) {
    const installMs = baseTime + i * 60000;
    const deltaDays = 2 + Math.floor(rng() * 3); // 2..4 days
    const touchMs = installMs - deltaDays * 86400 * 1000;
    rows.push(
      buildRow({
        appsflyerId: `af_flood_${i}`,
        mediaSource: "source_flood",
        touchTime: formatUtc(touchMs),
        installTime: formatUtc(installMs),
        ip: `110.22.2.${i}`,
        advertisingId: `flood-gaid-${i}`,
      }),
    );
  }

  // 3. IP Farm (>= 10 on same IP) — 14 rows on single IP
  const farmIp = "182.72.100.50";
  for (let i = 0; i < 14; i++) {
    rows.push(
      buildRow({
        appsflyerId: `af_ipfarm_${i}`,
        mediaSource: "source_ipfarm",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime + i * 1000),
        ip: farmIp,
        advertisingId: `farm-gaid-${i}`,
      }),
    );
  }

  // 4. Null Device Keywords ("unknown", "generic", "emulator", "sdk") — 16 rows
  const nullModels = ["Generic Android Emulator", "sdk_gphone64_arm64", "unknown_device", "google_sdk_x86"];
  for (let i = 0; i < 16; i++) {
    rows.push(
      buildRow({
        appsflyerId: `af_nulldev_${i}`,
        mediaSource: "source_nulldev",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime + i * 1000),
        ip: `110.22.3.${i}`,
        deviceModel: nullModels[i % nullModels.length],
        advertisingId: `nulldev-gaid-${i}`,
      }),
    );
  }

  // 5. Non-Primary Attribution (isPrimary === "false") — 12 rows
  for (let i = 0; i < 12; i++) {
    rows.push(
      buildRow({
        appsflyerId: `af_nonprimary_${i}`,
        mediaSource: "source_nonprimary",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime + i * 1000),
        ip: `110.22.4.${i}`,
        isPrimary: "false",
        advertisingId: `nonprimary-gaid-${i}`,
      }),
    );
  }

  // 6. Zeroed GAID — 12 rows
  for (let i = 0; i < 12; i++) {
    rows.push(
      buildRow({
        appsflyerId: `af_zerogaid_${i}`,
        mediaSource: "source_zerogaid",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime + i * 1000),
        ip: `110.22.5.${i}`,
        advertisingId: "00000000-0000-0000-0000-000000000000",
      }),
    );
  }

  // 7. GAID Reuse (>1 row with same GAID) — 10 rows (2 distinct GAIDs reused 5x each)
  for (let i = 0; i < 10; i++) {
    const reusedGaid = i < 5 ? "reused-gaid-alpha-1111" : "reused-gaid-beta-2222";
    rows.push(
      buildRow({
        appsflyerId: `af_reusegaid_${i}`,
        mediaSource: "source_reusegaid",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime + i * 1000),
        ip: `110.22.6.${i}`,
        advertisingId: reusedGaid,
      }),
    );
  }

  // 8. IDFA Reuse (>1 row with same IDFA) — 8 rows (iOS platform, 2 IDFAs reused 4x each)
  for (let i = 0; i < 8; i++) {
    const reusedIdfa = i < 4 ? "EA7583CD-A667-48BC-B806-42ECB2B48D12" : "FA8583CD-B778-49CD-C917-53FDC3C59E23";
    rows.push(
      buildRow({
        appsflyerId: `af_reuseidfa_${i}`,
        mediaSource: "source_reuseidfa",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime + i * 1000),
        ip: `110.22.7.${i}`,
        platform: "ios",
        idfa: reusedIdfa,
        advertisingId: "",
        deviceModel: "iPhone 14 Pro",
        osVersion: "16.5",
      }),
    );
  }

  // 9. Geo Mismatch (country != IN) — 15 rows
  const foreignCountries = ["US", "ID", "SG", "GB", "BR"];
  for (let i = 0; i < 15; i++) {
    rows.push(
      buildRow({
        appsflyerId: `af_geomismatch_${i}`,
        mediaSource: "source_geomismatch",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime + i * 1000),
        country: foreignCountries[i % foreignCountries.length],
        carrier: "LocalCarrier",
        ip: `110.22.8.${i}`,
        advertisingId: `geomismatch-gaid-${i}`,
      }),
    );
  }

  // 10. Country/Carrier Mismatch (country == IN, unexpected carrier) — 15 rows
  const unexpectedCarriers = ["Verizon", "AT&T", "Sprint", "T-Mobile"];
  for (let i = 0; i < 15; i++) {
    rows.push(
      buildRow({
        appsflyerId: `af_carriermismatch_${i}`,
        mediaSource: "source_carriermismatch",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime + i * 1000),
        country: "IN",
        carrier: unexpectedCarriers[i % unexpectedCarriers.length],
        ip: `110.22.9.${i}`,
        advertisingId: `carriermismatch-gaid-${i}`,
      }),
    );
  }

  // 11. Carrier IP Concentration (>= 10 rows on same IP + Carrier) — 12 rows
  const concIp = "49.36.200.10";
  const concCarrier = "Jio";
  for (let i = 0; i < 12; i++) {
    rows.push(
      buildRow({
        appsflyerId: `af_carrieripconc_${i}`,
        mediaSource: "source_carrieripconc",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime + i * 1000),
        ip: concIp,
        carrier: concCarrier,
        advertisingId: `carrieripconc-gaid-${i}`,
      }),
    );
  }

  // 12. Outdated OS (Android OS <= 9) — 16 rows
  const outdatedAndroid = ["8.0.0", "8.1.0", "9", "7.1.1"];
  for (let i = 0; i < 16; i++) {
    rows.push(
      buildRow({
        appsflyerId: `af_outdatedos_${i}`,
        mediaSource: "source_outdatedos",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime + i * 1000),
        osVersion: outdatedAndroid[i % outdatedAndroid.length],
        ip: `110.22.10.${i}`,
        advertisingId: `outdatedos-gaid-${i}`,
      }),
    );
  }

  // 13. Device Model Cluster (>= 10 rows with same model) — 14 rows
  const clusterModel = "Xiaomi Redmi Note 10";
  for (let i = 0; i < 14; i++) {
    rows.push(
      buildRow({
        appsflyerId: `af_devcluster_${i}`,
        mediaSource: "source_devcluster",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime + i * 1000),
        deviceModel: clusterModel,
        ip: `110.22.11.${i}`,
        advertisingId: `devcluster-gaid-${i}`,
      }),
    );
  }

  // 14. SDK Version Mismatch — source has 20 rows with 6.12.0, 3 rows with 5.4.0 (total 23 >= 5)
  for (let i = 0; i < 23; i++) {
    const isOutlier = i >= 20;
    rows.push(
      buildRow({
        appsflyerId: `af_sdkmismatch_${i}`,
        mediaSource: "source_sdkmismatch",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime + i * 1000),
        sdkVersion: isOutlier ? "5.4.0" : "6.12.0",
        ip: `110.22.12.${i}`,
        advertisingId: `sdkmismatch-gaid-${i}`,
      }),
    );
  }

  // 15. Time-of-Day Cluster — source has 25 rows, 10 of them clustered at 04:00 (10/25 = 40% >= 15%)
  const hour4Time = Date.UTC(2025, 0, 10, 4, 15, 0); // 04:15 UTC
  for (let i = 0; i < 25; i++) {
    const isCluster = i < 10;
    const instTime = isCluster ? hour4Time + i * 30000 : baseTime + (i - 10) * 3600000;
    rows.push(
      buildRow({
        appsflyerId: `af_timecluster_${i}`,
        mediaSource: "source_timecluster",
        touchTime: formatUtc(instTime - 120000),
        installTime: formatUtc(instTime),
        ip: `110.22.13.${i}`,
        advertisingId: `timecluster-gaid-${i}`,
      }),
    );
  }

  // 16. PAF reasons — 20 rows
  const pafCases = [
    { r: "click_flood", s: "high_ctit" },
    { r: "install_hijacking", s: "click_injection" },
    { r: "bots", s: "datacenter_ip" },
    { r: "bots", s: "device_farm" },
  ];
  for (let i = 0; i < 20; i++) {
    const paf = pafCases[i % pafCases.length];
    rows.push(
      buildRow({
        appsflyerId: `af_paf_${i}`,
        mediaSource: "source_paf",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime + i * 1000),
        fraudReason: paf.r,
        fraudSub: paf.s,
        ip: `110.22.14.${i}`,
        advertisingId: `paf-gaid-${i}`,
      }),
    );
  }

  // 17. Clean / Baseline rows to reach ~600 rows total
  const remaining = 600 - rows.length;
  const normalCarriers = ["Jio", "Airtel", "Vi", "Vodafone Idea", "BSNL"];
  const normalSources = ["googleadwords_int", "tiktok_int", "bytedance_int", "snapchat_int"];

  for (let i = 0; i < remaining; i++) {
    const ctitSec = 120 + Math.floor(rng() * 7200); // 2 min to 2 hours
    const instTime = baseTime + Math.floor(rng() * 86400 * 2) * 1000;
    const touchTime = instTime - ctitSec * 1000;
    // Keep device model occurrence <= 2 so it never hits threshold 10
    const mod = `CleanDeviceModel_${i % 200}`;
    const car = normalCarriers[i % normalCarriers.length];
    const src = normalSources[i % normalSources.length];
    rows.push(
      buildRow({
        appsflyerId: `af_clean_${i}`,
        mediaSource: src,
        touchTime: formatUtc(touchTime),
        installTime: formatUtc(instTime),
        deviceModel: mod,
        carrier: car,
        country: "IN",
        osVersion: "13",
        sdkVersion: "6.12.0",
        ip: `103.${10 + (i % 200)}.${100 + (i % 100)}.${1 + (i % 250)}`,
        advertisingId: `clean-gaid-${i}-${Math.floor(rng() * 100000)}`,
        isPrimary: "true",
      }),
    );
  }

  return { headers: FIXTURE_HEADERS, rows };
}

export function generateEventRows(seed = 42): { headers: string[]; rows: unknown[][] } {
  const rng = createRng(seed);
  const rows: unknown[][] = [];
  const baseTime = Date.UTC(2025, 0, 10, 10, 0, 0);

  // 1. Funnel Stages & Broken Funnel
  // Standard stages: "af_first_open" (0), "af_login" (1), "af_purchase" (2)
  // We simulate 40 users with varied funnels:
  // - 15 users: complete (af_first_open -> af_login -> af_purchase) = 45 event rows
  // - 10 users: missing stage 1 (has af_first_open and af_purchase, missing af_login) = 20 event rows
  // - 10 users: missing stage 0 & 1 (has only af_purchase) = 10 event rows
  // - 5 users: only af_first_open = 5 event rows
  let afCounter = 0;
  for (let u = 0; u < 15; u++) {
    const afId = `af_user_complete_${u}`;
    const instMs = baseTime + afCounter * 60000;
    afCounter++;
    // stage 0
    rows.push(
      buildRow({
        appsflyerId: afId,
        mediaSource: "source_funnel",
        installTime: formatUtc(instMs),
        eventTime: formatUtc(instMs + 5000),
        eventName: "af_first_open",
        ip: `49.32.10.${u}`,
        advertisingId: `funnel-gaid-${u}`,
      }),
    );
    // stage 1
    rows.push(
      buildRow({
        appsflyerId: afId,
        mediaSource: "source_funnel",
        installTime: formatUtc(instMs),
        eventTime: formatUtc(instMs + 30000),
        eventName: "af_login",
        ip: `49.32.10.${u}`,
        advertisingId: `funnel-gaid-${u}`,
      }),
    );
    // stage 2
    rows.push(
      buildRow({
        appsflyerId: afId,
        mediaSource: "source_funnel",
        installTime: formatUtc(instMs),
        eventTime: formatUtc(instMs + 120000),
        eventName: "af_purchase",
        ip: `49.32.10.${u}`,
        advertisingId: `funnel-gaid-${u}`,
      }),
    );
  }

  // Broken funnel (skipping af_login)
  for (let u = 0; u < 10; u++) {
    const afId = `af_user_skip_login_${u}`;
    const instMs = baseTime + afCounter * 60000;
    afCounter++;
    rows.push(
      buildRow({
        appsflyerId: afId,
        mediaSource: "source_funnel_broken",
        installTime: formatUtc(instMs),
        eventTime: formatUtc(instMs + 5000),
        eventName: "af_first_open",
        ip: `49.32.11.${u}`,
        advertisingId: `broken-gaid-${u}`,
      }),
    );
    rows.push(
      buildRow({
        appsflyerId: afId,
        mediaSource: "source_funnel_broken",
        installTime: formatUtc(instMs),
        eventTime: formatUtc(instMs + 120000),
        eventName: "af_purchase",
        ip: `49.32.11.${u}`,
        advertisingId: `broken-gaid-${u}`,
      }),
    );
  }

  // Broken funnel (skipping first open and login, direct purchase)
  for (let u = 0; u < 10; u++) {
    const afId = `af_user_direct_purchase_${u}`;
    const instMs = baseTime + afCounter * 60000;
    afCounter++;
    rows.push(
      buildRow({
        appsflyerId: afId,
        mediaSource: "source_funnel_broken",
        installTime: formatUtc(instMs),
        eventTime: formatUtc(instMs + 60000),
        eventName: "af_purchase",
        ip: `49.32.12.${u}`,
        advertisingId: `direct-purchase-gaid-${u}`,
      }),
    );
  }

  // 2. Uniform Timing:
  // source_uniform, event "af_purchase", exactly 30s post install for 8 distinct installs
  for (let u = 0; u < 8; u++) {
    const afId = `af_user_uniform_${u}`;
    const instMs = baseTime + afCounter * 60000;
    afCounter++;
    rows.push(
      buildRow({
        appsflyerId: afId,
        mediaSource: "source_uniform",
        installTime: formatUtc(instMs),
        eventTime: formatUtc(instMs + 30000), // 30s
        eventName: "af_purchase",
        ip: `49.32.13.${u}`,
        advertisingId: `uniform-gaid-${u}`,
      }),
    );
  }

  // 3. Repeat dimensional test cases in events so event mode detects install+event fraud
  // Click Injection in events (10 rows)
  for (let i = 0; i < 10; i++) {
    const touchMs = baseTime + i * 60000;
    const instMs = touchMs + 4000;
    rows.push(
      buildRow({
        appsflyerId: `af_ev_inj_${i}`,
        mediaSource: "source_ev_inj",
        touchTime: formatUtc(touchMs),
        installTime: formatUtc(instMs),
        eventTime: formatUtc(instMs + 10000),
        eventName: "af_first_open",
        ip: `110.22.101.${i}`,
      }),
    );
  }

  // Click Flooding in events (10 rows)
  for (let i = 0; i < 10; i++) {
    const instMs = baseTime + i * 60000;
    const touchMs = instMs - 3 * 86400 * 1000;
    rows.push(
      buildRow({
        appsflyerId: `af_ev_flood_${i}`,
        mediaSource: "source_ev_flood",
        touchTime: formatUtc(touchMs),
        installTime: formatUtc(instMs),
        eventTime: formatUtc(instMs + 10000),
        eventName: "af_first_open",
        ip: `110.22.102.${i}`,
      }),
    );
  }

  // IP Farm in events (12 rows on same IP)
  const evFarmIp = "182.72.100.99";
  for (let i = 0; i < 12; i++) {
    rows.push(
      buildRow({
        appsflyerId: `af_ev_farm_${i}`,
        mediaSource: "source_ev_farm",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime),
        eventTime: formatUtc(baseTime + (i + 1) * 1000),
        eventName: "af_login",
        ip: evFarmIp,
      }),
    );
  }

  // Zeroed GAID in events (10 rows)
  for (let i = 0; i < 10; i++) {
    rows.push(
      buildRow({
        appsflyerId: `af_ev_zerogaid_${i}`,
        mediaSource: "source_ev_zerogaid",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime),
        eventTime: formatUtc(baseTime + 15000),
        eventName: "af_first_open",
        advertisingId: "00000000-0000-0000-0000-000000000000",
        ip: `110.22.103.${i}`,
      }),
    );
  }

  // Geo Mismatch in events (10 rows)
  for (let i = 0; i < 10; i++) {
    rows.push(
      buildRow({
        appsflyerId: `af_ev_geomismatch_${i}`,
        mediaSource: "source_ev_geomismatch",
        country: "SG",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime),
        eventTime: formatUtc(baseTime + 15000),
        eventName: "af_first_open",
        ip: `110.22.104.${i}`,
      }),
    );
  }

  // Carrier Mismatch in events (10 rows)
  for (let i = 0; i < 10; i++) {
    rows.push(
      buildRow({
        appsflyerId: `af_ev_carriermismatch_${i}`,
        mediaSource: "source_ev_carriermismatch",
        country: "IN",
        carrier: "Verizon",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime),
        eventTime: formatUtc(baseTime + 15000),
        eventName: "af_first_open",
        ip: `110.22.105.${i}`,
      }),
    );
  }

  // Outdated OS in events (10 rows)
  for (let i = 0; i < 10; i++) {
    rows.push(
      buildRow({
        appsflyerId: `af_ev_outdatedos_${i}`,
        mediaSource: "source_ev_outdatedos",
        osVersion: "8.0.0",
        touchTime: formatUtc(baseTime - 120000),
        installTime: formatUtc(baseTime),
        eventTime: formatUtc(baseTime + 15000),
        eventName: "af_first_open",
        ip: `110.22.106.${i}`,
      }),
    );
  }

  // Fill up to ~800 rows with normal baseline events across various users
  const remaining = 800 - rows.length;
  const normalEvents = ["af_first_open", "af_login", "af_view_item", "af_add_to_cart", "af_purchase"];
  const normalSources = ["googleadwords_int", "tiktok_int", "snapchat_int", "organic"];

  for (let i = 0; i < remaining; i++) {
    const instTime = baseTime + Math.floor(rng() * 86400 * 3) * 1000;
    const evDelta = 10 + Math.floor(rng() * 3600); // 10s to 1 hour
    const evTime = instTime + evDelta * 1000;
    const ctit = 60 + Math.floor(rng() * 3600);
    const touchTime = instTime - ctit * 1000;
    const evName = normalEvents[i % normalEvents.length];
    const src = normalSources[i % normalSources.length];

    rows.push(
      buildRow({
        appsflyerId: `af_ev_clean_${i}`,
        mediaSource: src,
        touchTime: formatUtc(touchTime),
        installTime: formatUtc(instTime),
        eventTime: formatUtc(evTime),
        eventName: evName,
        deviceModel: `CleanDeviceModel_${i % 300}`,
        carrier: "Jio",
        country: "IN",
        osVersion: "13",
        sdkVersion: "6.12.0",
        ip: `103.20.${10 + (i % 200)}.${1 + (i % 250)}`,
        advertisingId: `ev-clean-gaid-${i}-${Math.floor(rng() * 100000)}`,
      }),
    );
  }

  return { headers: FIXTURE_HEADERS, rows };
}
