import fs from "fs";
import Papa from "papaparse";

const csvPath =
  "C:/Users/deepa/Downloads/export-messages-58dceadcc52a88028ea3-2025-11-30-30d-cf507c.csv";
const csvText = fs.readFileSync(csvPath, "utf8");

const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
const CHANNEL_TARGETS = {
  // Intentionally left blank. Retained as a placeholder for ad-hoc Front CSV checks.
  email: 24 * 60 * 60,
