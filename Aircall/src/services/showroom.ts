import Papa from "papaparse";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";

export type ShowroomRow = {
  dueDate: string; // YYYY-MM-DD
  aftershockPickups?: number;
  aftershockConversations?: number;
  aftershockSales?: number;
  omnideskVisitors?: number;
  omnideskSales?: number;
};

export type ShowroomMonthlyStats = {
  month: string; // YYYY-MM
  aftershockConversations: number;
  aftershockSales: number;
  omnideskVisitors: number;
  omnideskSales: number;
  aftershockConversionRate: number; // percent
  omnideskConversionRate: number; // percent
};

function parseNumber(v?: string): number | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s || s === "-" || s.toLowerCase() === "nan") return undefined;
  const n = Number(s.replace(/,/g, ""));
  return isFinite(n) ? n : undefined;
}

function normalizeDate(input: string): string | null {
  const s = String(input || "").trim();
  if (!s) return null;
  // Try native parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  // Try MM/DD/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

export async function parseShowroomCsv(file: File): Promise<ShowroomRow[]> {
  const raw = await file.text();
  // Find the actual header line (file may contain preface lines before headers)
  const lines = raw.split(/\r?\n/);
  let headerIdx = lines.findIndex(
    (l) => /(^|,)\s*Due Date\s*(,|$)/i.test(l) && /Task\s*ID/i.test(l)
  );
  if (headerIdx < 0) headerIdx = 0; // fallback to first line
  const text = lines.slice(headerIdx).join("\n");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => (h ?? "").trim(),
  });
  if (parsed.errors.length) {
    throw new Error("CSV parse error: " + parsed.errors[0].message);
  }
  const out: ShowroomRow[] = [];
  for (const r of parsed.data) {
    if (!r) continue;
    const dateRaw =
      r["Due Date"] || r["Date"] || r["due_date"] || r["Due date"] || "";
    const dueDate = normalizeDate(dateRaw);
    if (!dueDate) continue;
    out.push({
      dueDate,
      aftershockPickups: parseNumber(r["Aftershock Pickups (number)"]),
      aftershockConversations: parseNumber(
        r["Aftershock Conversations (number)"]
      ),
      aftershockSales: parseNumber(r["Aftershock Sales (number)"]),
      omnideskVisitors: parseNumber(r["Omnidesk Visitors (number)"]),
      omnideskSales: parseNumber(r["Omnidesk Sales (number)"]),
    });
  }
  if (!out.length) {
    throw new Error(
      "No showroom rows found. Ensure the CSV includes a 'Due Date' column."
    );
  }
  return out;
}

export function computeShowroomMonthly(
  rows: ShowroomRow[]
): ShowroomMonthlyStats[] {
  const byMonth = new Map<string, ShowroomMonthlyStats>();
  for (const r of rows) {
    const month = r.dueDate.slice(0, 7);
    const cur = byMonth.get(month) || {
      month,
      aftershockConversations: 0,
      aftershockSales: 0,
      omnideskVisitors: 0,
      omnideskSales: 0,
      aftershockConversionRate: 0,
      omnideskConversionRate: 0,
    };
    cur.aftershockConversations += r.aftershockConversations || 0;
    cur.aftershockSales += r.aftershockSales || 0;
    cur.omnideskVisitors += r.omnideskVisitors || 0;
    cur.omnideskSales += r.omnideskSales || 0;
    byMonth.set(month, cur);
  }
  // finalize rates
  const result = Array.from(byMonth.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({
      ...m,
      aftershockConversionRate:
        m.aftershockConversations > 0
          ? (m.aftershockSales / m.aftershockConversations) * 100
          : 0,
      omnideskConversionRate:
        m.omnideskVisitors > 0
          ? (m.omnideskSales / m.omnideskVisitors) * 100
          : 0,
    }));
  return result;
}

// ----- Persistence (Firestore) -----

export type ShowroomDailyDoc = {
  date: string; // YYYY-MM-DD (doc id)
  aftershockPickups?: number;
  aftershockConversations: number;
  aftershockSales: number;
  omnideskVisitors: number;
  omnideskSales: number;
  updatedAt?: any;
};

function aggregateByDate(rows: ShowroomRow[]): Map<string, ShowroomDailyDoc> {
  const map = new Map<string, ShowroomDailyDoc>();
  for (const r of rows) {
    const d = r.dueDate;
    const cur =
      map.get(d) ||
      ({
        date: d,
        aftershockPickups: 0,
        aftershockConversations: 0,
        aftershockSales: 0,
        omnideskVisitors: 0,
        omnideskSales: 0,
      } as ShowroomDailyDoc);
    cur.aftershockPickups =
      (cur.aftershockPickups || 0) + (r.aftershockPickups || 0);
    cur.aftershockConversations += r.aftershockConversations || 0;
    cur.aftershockSales += r.aftershockSales || 0;
    cur.omnideskVisitors += r.omnideskVisitors || 0;
    cur.omnideskSales += r.omnideskSales || 0;
    map.set(d, cur);
  }
  return map;
}

export async function saveShowroomDaily(rows: ShowroomRow[]) {
  const aggregates = aggregateByDate(rows);
  const col = collection(db, "showroomDaily");
  const toEntries = Array.from(aggregates.values());
  let written = 0;

  // chunked batch writes (<=500 ops per batch)
  const chunkSize = 400;
  for (let i = 0; i < toEntries.length; i += chunkSize) {
    const batch = writeBatch(db);
    const slice = toEntries.slice(i, i + chunkSize);
    for (const d of slice) {
      const ref = doc(col, d.date);
      // Read existing to avoid accidental double counting; keep the larger of existing vs new values
      // This ensures re-imports are idempotent and later imports with more complete numbers win.
      // We won't block on get in the hot path for every doc; but it's acceptable for modest sizes.
      // eslint-disable-next-line no-await-in-loop
      const existing = await getDoc(ref);
      if (existing.exists()) {
        const e = existing.data() as ShowroomDailyDoc;
        batch.set(
          ref,
          {
            date: d.date,
            aftershockPickups: Math.max(
              e.aftershockPickups || 0,
              d.aftershockPickups || 0
            ),
            aftershockConversations: Math.max(
              e.aftershockConversations || 0,
              d.aftershockConversations || 0
            ),
            aftershockSales: Math.max(
              e.aftershockSales || 0,
              d.aftershockSales || 0
            ),
            omnideskVisitors: Math.max(
              e.omnideskVisitors || 0,
              d.omnideskVisitors || 0
            ),
            omnideskSales: Math.max(e.omnideskSales || 0, d.omnideskSales || 0),
            updatedAt: serverTimestamp(),
          },
          { merge: false }
        );
      } else {
        batch.set(
          ref,
          { ...d, updatedAt: serverTimestamp() },
          { merge: false }
        );
      }
      written++;
    }
    await batch.commit();
  }
  return { daysUpserted: written };
}

export async function fetchShowroomDaily(): Promise<ShowroomRow[]> {
  const q = query(collection(db, "showroomDaily"), orderBy("date", "asc"));
  const snap = await getDocs(q);
  if (snap.empty) return [];
  return snap.docs.map((d) => {
    const v = d.data() as ShowroomDailyDoc;
    return {
      dueDate: v.date,
      aftershockPickups: v.aftershockPickups,
      aftershockConversations: v.aftershockConversations,
      aftershockSales: v.aftershockSales,
      omnideskVisitors: v.omnideskVisitors,
      omnideskSales: v.omnideskSales,
    } as ShowroomRow;
  });
}

export async function fetchShowroomMonthlyFromFirestore(): Promise<
  ShowroomMonthlyStats[]
> {
  const daily = await fetchShowroomDaily();
  if (!daily.length) return [];
  return computeShowroomMonthly(daily);
}
