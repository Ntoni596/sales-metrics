import { db } from "../firebase";
import type { DailyMetrics, CallRecord, MonthlyMetrics } from "../types";
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
  const q = query(
    collection(db, "dailyMetrics"),
    orderBy("date", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data() as DailyMetrics;
}

export async function getMonthlySummaries(): Promise<MonthlyMetrics[]> {
  const q = query(collection(db, "monthlyMetrics"), orderBy("month", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d: any) => d.data() as MonthlyMetrics);
}

// Fetch one monthly metrics doc by key YYYY-MM
export async function getMonthlyByMonth(
  month: string
): Promise<MonthlyMetrics | null> {
  const ref = doc(db, "monthlyMetrics", month);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as MonthlyMetrics) : null;
}

// Fetch all daily metrics within a specific month (YYYY-MM)
export async function getDailyForMonth(month: string) {
  // date is stored as YYYY-MM-DD; do a range query [month, nextMonth)
  const [y, m] = month.split("-").map((s) => parseInt(s, 10));
  const next =
    m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const q = query(
    collection(db, "dailyMetrics"),
    where("date", ">=", `${month}-01`),
    where("date", "<", `${next}-01`),
    orderBy("date", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d: any) => d.data() as DailyMetrics);
}

// Fetch a single day's metrics by date (YYYY-MM-DD)
export async function getDailyByDate(date: string) {
  const ref = doc(db, "dailyMetrics", date);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as DailyMetrics) : null;
}
