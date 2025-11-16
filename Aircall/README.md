# Aircall Performance Dashboard

React + TypeScript + Vite application for uploading Aircall CSV exports, computing daily and monthly performance metrics, visualizing trends, and storing historical data in Firebase Firestore.

## Features

- Upload daily Aircall CSV export (drag file via file input)
- Automatic parsing of inbound/outbound, answered, missed (reason breakdown), wait time and tags
- Formula for effective inbound: `Inbound Effective = Inbound Raw - (Missed Outside Business Hours + Missed Abandoned)`
- Daily summary with copy/paste EOD block
- Agent performance table (inbound answered/missed, outbound answered, average wait)
- Categories (tags) bar visualization
- Charts (missed breakdown pie, overall performance bar)
- Historical monthly aggregation with MoM percentage deltas
- Firebase Firestore persistence (daily documents + monthly roll-ups)

## Data Model

`DailyMetrics` document (collection: `dailyMetrics`):

- `date` (YYYY-MM-DD)
- `inboundRaw`, `inboundEffective`, `outbound`, `answered`, `missed`
- `missedBreakdown` (outside_hours, abandoned, agent_unavailable, agent_no_answer)
- `answerable` (alias of inboundEffective)
- `avgWaitSeconds`
- `topInboundPerformer` { user, count }
- `agentStats[]` with per-agent inbound/outbound breakdown
- `categoryCounts[]` tag frequencies

`MonthlyMetrics` document (collection: `monthlyMetrics`):

- `month` (YYYY-MM)
- aggregated totals + weighted `avgWaitSeconds`

## CSV Expectations

Headers are matched flexibly (case-insensitive). Recommended fields:

- `Direction` (Inbound/Outbound)
- `Status` or `Answered`
- `Missed - Outside business hours`, `Missed - Abandoned`, `Missed - No agent available`, `Missed - Agent did not answer`
- `Agent` (user handling call)
- `Wait Time (s)` (queue/wait duration)
- `Tags` (comma/semicolon separated list)
- `Time` or `Timestamp` (parseable date/time)

Adjust header names in `src/services/metrics.tsx` if needed.

## Firebase Setup

Create a `.env` file in project root with (prefix `VITE_` required):

```
VITE_FIREBASE_API_KEY=YOUR_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_APP_ID=YOUR_APP_ID
```

Then restart dev server.

## Getting Started

```powershell
# from the Aircall folder
npm install
npm run dev
```

Open the printed local URL and upload a CSV.

## Copy/Paste EOD Block

Found in the Daily Summary panel; includes inbound effective, outbound, missed %, answered, avg wait, top inbound agent and top categories.

## Month-over-Month Metrics

History table computes percentage change vs previous month for inbound effective and answered calls.

## Deploy to GitHub Pages

This repo includes a workflow at `.github/workflows/deploy-pages.yml` that:

- Builds the app from the `Aircall` subfolder
- Sets the correct Vite base path for Pages automatically
- Publishes the `dist/` output to GitHub Pages

Before running, add repository Secrets (Settings → Secrets and variables → Actions):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- Optional: `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_MEASUREMENT_ID`

Optional repository Variables:

- `VITE_BUSINESS_HOURS_START` (e.g. `11:00`)
- `VITE_BUSINESS_HOURS_END` (e.g. `19:00`)

Push to `main` or run the workflow manually. The Pages deployment URL will appear in the workflow summary.

## Troubleshooting

- If Firestore writes fail: verify `.env` values and network access
- If parsing misses columns: inspect header names and update mapping logic in `metrics.tsx`
- If charts show empty data: ensure CSV has at least one row with timestamps

## License

Internal use. Remove/replace if distributing publicly.
