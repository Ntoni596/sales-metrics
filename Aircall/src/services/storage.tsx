import { db } from "../firebase";
import type {
  DailyMetrics,
  CallRecord,
  MonthlyMetrics,
  FrontAnalytics,
  FrontChannelKey,
  FrontChannelStats,
  FrontDailySummary,
  FrontMonthlySummary,
} from "../types";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
  writeBatch,
  where,
} from "firebase/firestore";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

function isExpired(entry: CacheEntry<unknown>) {
  return entry.expiresAt !== Infinity && entry.expiresAt < Date.now();
}

function getCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (isExpired(entry)) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCacheValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs = CACHE_TTL_MS
) {
  cache.set(key, {
    value,
    expiresAt: ttlMs === Infinity ? Infinity : Date.now() + ttlMs,
  });
  return value;
}

async function fetchWithCache<T>(
  cache: Map<string, CacheEntry<T>>,
  pending: Map<string, Promise<T>>,
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = CACHE_TTL_MS
): Promise<T> {
  const cached = getCacheValue(cache, key);
  if (cached !== undefined) return cached;
  const existing = pending.get(key);
  if (existing) return existing;
  const promise = fetcher()
    .then((res) => setCacheValue(cache, key, res, ttlMs))
    .finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}

const LATEST_DAILY_KEY = "latest";
const MONTHLY_SUMMARIES_KEY = "monthlySummaries";
const FRONT_MONTHLY_SUMMARIES_KEY = "frontMonthlySummaries";

const latestDailyCache = new Map<string, CacheEntry<DailyMetrics | null>>();
const latestDailyPending = new Map<string, Promise<DailyMetrics | null>>();

const monthlySummariesCache = new Map<string, CacheEntry<MonthlyMetrics[]>>();
const monthlySummariesPending = new Map<string, Promise<MonthlyMetrics[]>>();

const monthlyByMonthCache = new Map<
  string,
  CacheEntry<MonthlyMetrics | null>
>();
const monthlyByMonthPending = new Map<string, Promise<MonthlyMetrics | null>>();

const dailyByMonthCache = new Map<string, CacheEntry<DailyMetrics[]>>();
const dailyByMonthPending = new Map<string, Promise<DailyMetrics[]>>();

const dailyByDateCache = new Map<string, CacheEntry<DailyMetrics | null>>();
const dailyByDatePending = new Map<string, Promise<DailyMetrics | null>>();

const frontMonthlySummariesCache = new Map<
  string,
  CacheEntry<FrontMonthlySummary[]>
>();
const frontMonthlySummariesPending = new Map<
  string,
  Promise<FrontMonthlySummary[]>
>();

const frontMonthlyByMonthCache = new Map<
  string,
  CacheEntry<FrontMonthlySummary | null>
>();
const frontMonthlyByMonthPending = new Map<
  string,
  Promise<FrontMonthlySummary | null>
>();

const frontDailyByMonthCache = new Map<
  string,
  CacheEntry<FrontDailySummary[]>
>();
const frontDailyByMonthPending = new Map<
  string,
  Promise<FrontDailySummary[]>
>();

export async function saveDailyMetrics(
  summary: DailyMetrics,
  records: CallRecord[]
) {
  console.log("[saveDailyMetrics] begin", {
    date: summary.date,
    month: summary.date.slice(0, 7),
    records: records?.length || 0,
    inboundEffective: summary.inboundEffective,
    answered: summary.answered,
    missed: summary.missed,
  });
  const dayRef = doc(db, "dailyMetrics", summary.date);
  const base = { ...summary, createdAt: serverTimestamp() };
  console.log("[saveDailyMetrics] writing daily doc", dayRef.path);
  let _pending = true;
  const warnTimer = setTimeout(() => {
    if (_pending)
      console.warn(
        "[saveDailyMetrics] setDoc still pending after 5s (check network/rules)"
      );
  }, 5000);
  try {
    await setDoc(dayRef, base, { merge: true });
  } catch (e) {
    console.error("[saveDailyMetrics] setDoc error", e);
    clearTimeout(warnTimer);
    _pending = false;
    throw e;
  }
  clearTimeout(warnTimer);
  _pending = false;
  console.log("[saveDailyMetrics] dailyMetrics upserted", summary.date);
  // Store records in subcollection (optional)
  if (records && records.length) {
    const chunkSize = 400; // Firestore limit per batch is 500 ops
    for (let i = 0; i < records.length; i += chunkSize) {
      const batch = writeBatch(db);
      const slice = records.slice(i, i + chunkSize);
      for (const r of slice) {
        const recRef = doc(collection(dayRef, "records"));
        batch.set(recRef, { ...r });
      }
      await batch.commit();
      console.log("[saveDailyMetrics] wrote record batch", {
        from: i,
        to: i + slice.length - 1,
        count: slice.length,
      });
    }
  }
  await updateMonthlyAggregate(summary);
  const monthKey = summary.date.slice(0, 7);
  latestDailyCache.delete(LATEST_DAILY_KEY);
  latestDailyPending.delete(LATEST_DAILY_KEY);
  dailyByDateCache.delete(summary.date);
  dailyByDatePending.delete(summary.date);
  dailyByMonthCache.delete(monthKey);
  dailyByMonthPending.delete(monthKey);
  monthlyByMonthCache.delete(monthKey);
  monthlyByMonthPending.delete(monthKey);
  monthlySummariesCache.clear();
  monthlySummariesPending.clear();
  console.log("[saveDailyMetrics] done", summary.date);
}

async function updateMonthlyAggregate(summary: DailyMetrics) {
  const month = summary.date.slice(0, 7); // YYYY-MM
  const monthRef = doc(db, "monthlyMetrics", month);
  const existing = await getDoc(monthRef);
  if (!existing.exists()) {
    const init: MonthlyMetrics = {
      month,
      days: 1,
      inboundEffective: summary.inboundEffective,
      outbound: summary.outbound,
      missed: summary.missed,
      answered: summary.answered,
      avgWaitSeconds: summary.avgWaitSeconds,
    };
    await setDoc(monthRef, init);
    console.log("[monthlyAggregate] created", init);
  } else {
    const data = existing.data() as MonthlyMetrics;
    console.log("[monthlyAggregate] existing", data);
    const totalAnsweredWait =
      data.avgWaitSeconds * data.answered +
      summary.avgWaitSeconds * summary.answered;
    const answeredSum = data.answered + summary.answered;
    const newAvgWait = answeredSum ? totalAnsweredWait / answeredSum : 0;
    await updateDoc(monthRef, {
      days: data.days + 1,
      inboundEffective: data.inboundEffective + summary.inboundEffective,
      outbound: data.outbound + summary.outbound,
      missed: data.missed + summary.missed,
      answered: answeredSum,
      avgWaitSeconds: newAvgWait,
    });
    console.log("[monthlyAggregate] updated", {
      month,
      days: data.days + 1,
      inboundEffective: data.inboundEffective + summary.inboundEffective,
      outbound: data.outbound + summary.outbound,
      missed: data.missed + summary.missed,
      answered: answeredSum,
      avgWaitSeconds: newAvgWait,
    });
  }
}

export async function getLatestDaily(): Promise<DailyMetrics | null> {
  return fetchWithCache(
    latestDailyCache,
    latestDailyPending,
    LATEST_DAILY_KEY,
    async () => {
      const q = query(
        collection(db, "dailyMetrics"),
        orderBy("date", "desc"),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      return snap.docs[0].data() as DailyMetrics;
    }
  );
}

export async function getMonthlySummaries(): Promise<MonthlyMetrics[]> {
  return fetchWithCache(
    monthlySummariesCache,
    monthlySummariesPending,
    MONTHLY_SUMMARIES_KEY,
    async () => {
      const q = query(
        collection(db, "monthlyMetrics"),
        orderBy("month", "desc")
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as MonthlyMetrics);
    }
  );
}

// Fetch one monthly metrics doc by key YYYY-MM
export async function getMonthlyByMonth(
  month: string
): Promise<MonthlyMetrics | null> {
  return fetchWithCache(
    monthlyByMonthCache,
    monthlyByMonthPending,
    month,
    async () => {
      const ref = doc(db, "monthlyMetrics", month);
      const snap = await getDoc(ref);
      return snap.exists() ? (snap.data() as MonthlyMetrics) : null;
    }
  );
}

// Fetch all daily metrics within a specific month (YYYY-MM)
export async function getDailyForMonth(month: string) {
  // date is stored as YYYY-MM-DD; do a range query [month, nextMonth)
  const [y, m] = month.split("-").map((s) => parseInt(s, 10));
  const next =
    m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return fetchWithCache(
    dailyByMonthCache,
    dailyByMonthPending,
    month,
    async () => {
      const q = query(
        collection(db, "dailyMetrics"),
        where("date", ">=", `${month}-01`),
        where("date", "<", `${next}-01`),
        orderBy("date", "desc")
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as DailyMetrics);
    }
  );
}

// Fetch a single day's metrics by date (YYYY-MM-DD)
export async function getDailyByDate(date: string) {
  return fetchWithCache(
    dailyByDateCache,
    dailyByDatePending,
    date,
    async () => {
      const ref = doc(db, "dailyMetrics", date);
      const snap = await getDoc(ref);
      return snap.exists() ? (snap.data() as DailyMetrics) : null;
    }
  );
}

export async function saveFrontSummaries(analytics: FrontAnalytics) {
  if (!analytics) return;
  const affectedMonths = new Set<string>();
  const batch = writeBatch(db);
  for (const day of analytics.daily) {
    const ref = doc(db, "frontDaily", day.date);
    affectedMonths.add(day.date.slice(0, 7));
    batch.set(ref, {
      date: day.date,
      conversations: day.conversations,
      inboundMessages: day.inboundMessages,
      outboundMessages: day.outboundMessages,
      afterHoursConversations: day.afterHoursConversations,
      metResponseTarget: day.metResponseTarget,
      avgFirstResponseSeconds: day.avgFirstResponseSeconds ?? null,
      p90FirstResponseSeconds: day.p90FirstResponseSeconds ?? null,
      avgHandleSeconds: day.avgHandleSeconds ?? null,
      topTags: day.topTags || [],
      updatedAt: serverTimestamp(),
    });
  }
  for (const month of analytics.monthly) {
    const ref = doc(db, "frontMonthly", month.month);
    affectedMonths.add(month.month);
    batch.set(ref, {
      month: month.month,
      conversations: month.conversations,
      inboundMessages: month.inboundMessages,
      outboundMessages: month.outboundMessages,
      afterHoursConversations: month.afterHoursConversations,
      metResponseTarget: month.metResponseTarget,
      avgFirstResponseSeconds: month.avgFirstResponseSeconds ?? null,
      p90FirstResponseSeconds: month.p90FirstResponseSeconds ?? null,
      avgHandleSeconds: month.avgHandleSeconds ?? null,
      uniqueContacts: month.uniqueContacts || 0,
      topTags: month.topTags || [],
      agentLeaders: month.agentLeaders || [],
      aiInsights: month.aiInsights || [],
      channels: month.channels || {},
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  frontMonthlySummariesCache.clear();
  frontMonthlySummariesPending.clear();
  for (const key of affectedMonths) {
    frontMonthlyByMonthCache.delete(key);
    frontMonthlyByMonthPending.delete(key);
    frontDailyByMonthCache.delete(key);
    frontDailyByMonthPending.delete(key);
  }
}

export async function getFrontMonthlySummaries(): Promise<
  FrontMonthlySummary[]
> {
  return fetchWithCache(
    frontMonthlySummariesCache,
    frontMonthlySummariesPending,
    FRONT_MONTHLY_SUMMARIES_KEY,
    async () => {
      const q = query(collection(db, "frontMonthly"), orderBy("month", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((d) => normalizeFrontMonthly(d.data()));
    }
  );
}

export async function getFrontMonthlySummary(
  month: string
): Promise<FrontMonthlySummary | null> {
  return fetchWithCache(
    frontMonthlyByMonthCache,
    frontMonthlyByMonthPending,
    month,
    async () => {
      const ref = doc(db, "frontMonthly", month);
      const snap = await getDoc(ref);
      return snap.exists() ? normalizeFrontMonthly(snap.data()) : null;
    }
  );
}

export async function getFrontDailyForMonth(
  month: string
): Promise<FrontDailySummary[]> {
  const [y, m] = month.split("-").map((s) => parseInt(s, 10));
  const next =
    m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return fetchWithCache(
    frontDailyByMonthCache,
    frontDailyByMonthPending,
    month,
    async () => {
      const q = query(
        collection(db, "frontDaily"),
        where("date", ">=", `${month}-01`),
        where("date", "<", `${next}-01`),
        orderBy("date", "desc")
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => normalizeFrontDaily(d.data()));
    }
  );
}

function normalizeFrontMonthly(doc: unknown): FrontMonthlySummary {
  const data =
    (doc as Partial<FrontMonthlySummary> & {
      channels?: Record<string, Partial<FrontChannelStats>>;
    }) || {};
  const channelsRaw = data.channels || {};
  const channelKeys: FrontChannelKey[] = ["livechat", "email"];
  const channelStats: Partial<Record<FrontChannelKey, FrontChannelStats>> = {};
  for (const key of channelKeys) {
    const value = channelsRaw[key];
    if (!value) continue;
    const legacyMet = (value as { respondedWithin2m?: number })
      .respondedWithin2m;
    channelStats[key] = {
      conversations: value.conversations ?? 0,
      inboundMessages: value.inboundMessages ?? 0,
      outboundMessages: value.outboundMessages ?? 0,
      afterHoursConversations: value.afterHoursConversations ?? 0,
      metResponseTarget: value.metResponseTarget ?? legacyMet ?? 0,
      avgFirstResponseSeconds: value.avgFirstResponseSeconds ?? null,
      avgHandleSeconds: value.avgHandleSeconds ?? null,
    };
  }
  return {
    month: data.month ?? "",
    conversations: data.conversations ?? 0,
    inboundMessages: data.inboundMessages ?? 0,
    outboundMessages: data.outboundMessages ?? 0,
    afterHoursConversations: data.afterHoursConversations ?? 0,
    metResponseTarget:
      data.metResponseTarget ??
      (data as { respondedWithin2m?: number }).respondedWithin2m ??
      0,
    avgFirstResponseSeconds: data.avgFirstResponseSeconds ?? null,
    p90FirstResponseSeconds: data.p90FirstResponseSeconds ?? null,
    avgHandleSeconds: data.avgHandleSeconds ?? null,
    uniqueContacts: data.uniqueContacts ?? 0,
    topTags: Array.isArray(data.topTags) ? data.topTags : [],
    agentLeaders: Array.isArray(data.agentLeaders) ? data.agentLeaders : [],
    aiInsights: Array.isArray(data.aiInsights) ? data.aiInsights : [],
    channels: Object.keys(channelStats).length ? channelStats : undefined,
    updatedAt: data.updatedAt,
  };
}

function normalizeFrontDaily(doc: unknown): FrontDailySummary {
  const data = (doc as Partial<FrontDailySummary>) || {};
  const legacyMet = (data as { respondedWithin2m?: number }).respondedWithin2m;
  return {
    date: data.date ?? "",
    conversations: data.conversations ?? 0,
    inboundMessages: data.inboundMessages ?? 0,
    outboundMessages: data.outboundMessages ?? 0,
    afterHoursConversations: data.afterHoursConversations ?? 0,
    metResponseTarget: data.metResponseTarget ?? legacyMet ?? 0,
    avgFirstResponseSeconds: data.avgFirstResponseSeconds ?? null,
    p90FirstResponseSeconds: data.p90FirstResponseSeconds ?? null,
    avgHandleSeconds: data.avgHandleSeconds ?? null,
    topTags: Array.isArray(data.topTags) ? data.topTags : [],
  };
}
