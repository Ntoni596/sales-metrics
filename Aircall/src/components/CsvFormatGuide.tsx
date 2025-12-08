import { useState } from "react";

export function CsvFormatGuide() {
  const [isExpanded, setIsExpanded] = useState(false);

  const newHeaders = [
    "line",
    "datetime (tz offset incl.)",
    "number timezone",
    "datetime (utc)",
    "country_code",
    "direction",
    "from",
    "to",
    "answered",
    "missed_call_reason",
    "user",
    "duration (total)",
    "duration (in call)",
    "voicemail",
    "recording",
    "comments",
    "tags",
    "call quality",
    "team",
    "call direction - type",
    "call start time",
    "call end time",
    "aircall number",
    "customer number",
    "in-call duration",
    "call id",
    "call type",
    "waiting time",
    "time to answer",
    "time in ivr",
    "call id (internal)",
    "disconnected by",
    "ivr branch",
    "ivr widget",
    "call timeline",
    "callback details",
    "callback failure",
    "automatic callback pending time",
    "time with ai voice agent",
    "entry number",
    "ai voice agent transfer branch",
  ];

  const criticalFields = [
    { header: "datetime (utc)", description: "Call timestamp in UTC" },
    { header: "direction", description: "Inbound or Outbound" },
    {
      header: "answered",
      description: "Whether call was answered (yes/no, true/false, 1/0)",
    },
    { header: "user", description: "Agent who handled the call" },
    { header: "missed_call_reason", description: "Reason for missed calls" },
    { header: "waiting time", description: "Time caller waited in queue" },
    { header: "tags", description: "Call categories/labels" },
  ];

  return (
    <div className='panel' style={{ padding: 16, marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0 }}>CSV Format Guide</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: "none",
            border: "none",
            color: "#3b82f6",
            cursor: "pointer",
            fontSize: "0.9em",
          }}
        >
          {isExpanded ? "Hide Details" : "Show Details"}
        </button>
      </div>

      {isExpanded && (
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ color: "#059669", marginBottom: 8 }}>
              ✓ Supported Headers ({newHeaders.length} total)
            </h4>
            <p
              style={{ fontSize: "0.9em", color: "#6b7280", marginBottom: 12 }}
            >
              The system now supports the complete Aircall export format.
              Headers are matched case-insensitively.
            </p>
            <div
              style={{
                maxHeight: 150,
                overflow: "auto",
                background: "#f9fafb",
                padding: 12,
                borderRadius: 4,
                fontFamily: "monospace",
                fontSize: "0.8em",
              }}
            >
              {newHeaders.map((header, i) => (
                <span key={header}>
                  {header}
                  {i < newHeaders.length - 1 && ", "}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h4 style={{ color: "#dc2626", marginBottom: 8 }}>
              🔴 Critical Fields
            </h4>
            <p
              style={{ fontSize: "0.9em", color: "#6b7280", marginBottom: 12 }}
            >
              These fields are required for core functionality:
            </p>
            {criticalFields.map((field) => (
              <div
                key={field.header}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 12px",
                  margin: "4px 0",
                  background: "#fef2f2",
                  borderRadius: 4,
                  border: "1px solid #fca5a5",
                }}
              >
                <code style={{ fontWeight: 600, color: "#dc2626" }}>
                  {field.header}
                </code>
                <span style={{ fontSize: "0.85em", color: "#6b7280" }}>
                  {field.description}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: "#f0f9ff",
              border: "1px solid #7dd3fc",
              borderRadius: 4,
            }}
          >
            <strong>💡 Pro Tip:</strong>
            <span style={{ marginLeft: 8, fontSize: "0.9em" }}>
              If your CSV uses different header names, you can configure the
              mappings in
              <strong> Settings → CSV Headers</strong> without changing your
              files.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
