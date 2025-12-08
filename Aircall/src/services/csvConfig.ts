import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export interface CsvHeaderMapping {
  // Core fields
  timestamp: string[];
  direction: string[];
  answered: string[];
  missedReason: string[];
  user: string[];
  waitTime: string[];
  tags: string[];
  line: string[]; // Call line/category identifier

  // Additional fields from new headers
  countryCode: string[];
  fromNumber: string[];
  toNumber: string[];
  duration: string[];
  inCallDuration: string[];
  voicemail: string[];
  recording: string[];
  comments: string[];
  callQuality: string[];
  team: string[];
  callStartTime: string[];
  callEndTime: string[];
  aircallNumber: string[];
  customerNumber: string[];
  callId: string[];
  callType: string[];
  timeToAnswer: string[];
  timeInIvr: string[];
  disconnectedBy: string[];
  ivrBranch: string[];
}

export const DEFAULT_CSV_MAPPING: CsvHeaderMapping = {
  // Core fields - existing mappings
  timestamp: [
    "datetime (utc)",
    "datetime (tz offset incl.)",
    "Time",
    "Timestamp",
    "Date",
    "call start time",
    "Started At",
    "Started at",
    "Start Time",
    "Call Started At",
    "Created At",
    "Date/Time",
    "Call Date",
  ],
  direction: ["direction", "Direction", "call direction - type"],
  answered: ["answered", "Answered", "Call Type", "Call Status", "Status"],
  missedReason: ["missed_call_reason", "missed call reason", "Missed cause"],
  user: ["user", "Agent", "User", "Owner", "Answered By"],
  waitTime: [
    "waiting time",
    "time to answer",
    "Wait Time (s)",
    "Waiting time (s)",
    "Waiting Time",
    "Time to answer",
    "wait",
    "queue_time",
  ],
  tags: ["tags", "Tags", "Tag", "Labels"],
  line: ["line", "Line", "Call Line", "Category"],

  // New fields from updated CSV format
  countryCode: ["country_code", "country code", "Country Code"],
  fromNumber: ["from", "From", "From Number", "Caller"],
  toNumber: ["to", "To", "To Number", "Called Number"],
  duration: [
    "duration (total)",
    "duration",
    "Duration",
    "Total Duration",
    "Call Duration",
  ],
  inCallDuration: [
    "duration (in call)",
    "in-call duration",
    "In Call Duration",
    "Talk Time",
  ],
  voicemail: ["voicemail", "Voicemail", "Voice Mail"],
  recording: ["recording", "Recording", "Call Recording"],
  comments: ["comments", "Comments", "Notes"],
  callQuality: ["call quality", "Call Quality", "Quality"],
  team: ["team", "Team", "Department"],
  callStartTime: ["call start time", "Call Start Time", "Start Time"],
  callEndTime: ["call end time", "Call End Time", "End Time"],
  aircallNumber: ["aircall number", "Aircall Number", "System Number"],
  customerNumber: ["customer number", "Customer Number", "Client Number"],
  callId: ["call id", "Call ID", "call id (internal)"],
  callType: ["call type", "Call Type"],
  timeToAnswer: ["time to answer", "Time to Answer", "Answer Time"],
  timeInIvr: ["time in ivr", "Time in IVR", "IVR Time"],
  disconnectedBy: ["disconnected by", "Disconnected By", "Disconnected"],
  ivrBranch: ["ivr branch", "IVR Branch", "IVR Path"],
};

const CSV_CONFIG_DOC = "csv-header-config";

/**
 * Load CSV header mapping configuration from Firestore
 */
export async function loadCsvConfig(): Promise<CsvHeaderMapping> {
  try {
    const docRef = doc(db, "settings", CSV_CONFIG_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as CsvHeaderMapping;
      // Merge with defaults to ensure all fields exist
      return {
        ...DEFAULT_CSV_MAPPING,
        ...data,
      };
    }
  } catch (error) {
    console.warn("Failed to load CSV config, using defaults:", error);
  }

  return DEFAULT_CSV_MAPPING;
}

/**
 * Save CSV header mapping configuration to Firestore
 */
export async function saveCsvConfig(config: CsvHeaderMapping): Promise<void> {
  const docRef = doc(db, "settings", CSV_CONFIG_DOC);
  await setDoc(docRef, config);
}

/**
 * Find the best matching header from available headers using the mapping
 */
export function findMatchingHeader(
  availableHeaders: string[],
  mappingOptions: string[]
): string | undefined {
  // Create case-insensitive lookup
  const headerLookup = new Map<string, string>();
  availableHeaders.forEach((h) => {
    headerLookup.set(h.toLowerCase().trim(), h);
  });

  // Try each mapping option in order of priority
  for (const option of mappingOptions) {
    const normalized = option.toLowerCase().trim();
    if (headerLookup.has(normalized)) {
      return headerLookup.get(normalized);
    }
  }

  return undefined;
}
