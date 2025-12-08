import { useState, useEffect } from "react";
import {
  DEFAULT_CSV_MAPPING,
  loadCsvConfig,
  saveCsvConfig,
} from "../services/csvConfig";

import type { CsvHeaderMapping } from "../services/csvConfig";

export function CsvHeaderSettings() {
  const [config, setConfig] = useState<CsvHeaderMapping>(DEFAULT_CSV_MAPPING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const loadedConfig = await loadCsvConfig();
      setConfig(loadedConfig);
    } catch (err: any) {
      setError(err.message || "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await saveCsvConfig(config);
      setSuccess("Configuration saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_CSV_MAPPING);
  };

  const updateFieldMapping = (
    field: keyof CsvHeaderMapping,
    newHeaders: string[]
  ) => {
    setConfig((prev) => ({
      ...prev,
      [field]: newHeaders,
    }));
  };

  const addHeaderOption = (field: keyof CsvHeaderMapping) => {
    const current = config[field] || [];
    updateFieldMapping(field, [...current, ""]);
  };

  const removeHeaderOption = (field: keyof CsvHeaderMapping, index: number) => {
    const current = config[field] || [];
    const filtered = current.filter((_, i) => i !== index);
    updateFieldMapping(field, filtered);
  };

  const updateHeaderOption = (
    field: keyof CsvHeaderMapping,
    index: number,
    value: string
  ) => {
    const current = [...(config[field] || [])];
    current[index] = value;
    updateFieldMapping(field, current);
  };

  if (loading) {
    return <div>Loading CSV configuration...</div>;
  }

  const fieldGroups = [
    {
      title: "Core Fields",
      fields: [
        {
          key: "timestamp" as const,
          label: "Timestamp/Date",
          description: "Date and time of the call",
        },
        {
          key: "direction" as const,
          label: "Call Direction",
          description: "Inbound or Outbound",
        },
        {
          key: "answered" as const,
          label: "Answered Status",
          description: "Whether the call was answered",
        },
        {
          key: "missedReason" as const,
          label: "Missed Reason",
          description: "Why the call was missed",
        },
        {
          key: "user" as const,
          label: "Agent/User",
          description: "Agent who handled the call",
        },
        {
          key: "waitTime" as const,
          label: "Wait Time",
          description: "Time caller waited in queue",
        },
        {
          key: "tags" as const,
          label: "Tags/Labels",
          description: "Call tags or categories",
        },
        {
          key: "line" as const,
          label: "Line/Category",
          description: "Call line or category identifier",
        },
      ],
    },
    {
      title: "Call Details",
      fields: [
        {
          key: "countryCode" as const,
          label: "Country Code",
          description: "Country code of caller",
        },
        {
          key: "fromNumber" as const,
          label: "From Number",
          description: "Caller's phone number",
        },
        {
          key: "toNumber" as const,
          label: "To Number",
          description: "Called phone number",
        },
        {
          key: "duration" as const,
          label: "Total Duration",
          description: "Total call duration",
        },
        {
          key: "inCallDuration" as const,
          label: "In-Call Duration",
          description: "Actual conversation time",
        },
        {
          key: "callId" as const,
          label: "Call ID",
          description: "Unique call identifier",
        },
        {
          key: "callType" as const,
          label: "Call Type",
          description: "Type of call",
        },
      ],
    },
    {
      title: "System & Quality",
      fields: [
        {
          key: "voicemail" as const,
          label: "Voicemail",
          description: "Voicemail information",
        },
        {
          key: "recording" as const,
          label: "Recording",
          description: "Call recording details",
        },
        {
          key: "callQuality" as const,
          label: "Call Quality",
          description: "Quality rating",
        },
        {
          key: "team" as const,
          label: "Team",
          description: "Team or department",
        },
        {
          key: "aircallNumber" as const,
          label: "Aircall Number",
          description: "System phone number",
        },
        {
          key: "customerNumber" as const,
          label: "Customer Number",
          description: "Customer identifier",
        },
      ],
    },
    {
      title: "Timing & Technical",
      fields: [
        {
          key: "callStartTime" as const,
          label: "Call Start Time",
          description: "When call started",
        },
        {
          key: "callEndTime" as const,
          label: "Call End Time",
          description: "When call ended",
        },
        {
          key: "timeToAnswer" as const,
          label: "Time to Answer",
          description: "Time before call was answered",
        },
        {
          key: "timeInIvr" as const,
          label: "Time in IVR",
          description: "Time spent in IVR system",
        },
        {
          key: "disconnectedBy" as const,
          label: "Disconnected By",
          description: "Who disconnected the call",
        },
        {
          key: "ivrBranch" as const,
          label: "IVR Branch",
          description: "IVR path taken",
        },
        {
          key: "comments" as const,
          label: "Comments/Notes",
          description: "Additional call notes",
        },
      ],
    },
  ];

  return (
    <div className='panel' style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>CSV Header Configuration</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type='button'
            onClick={handleReset}
            disabled={saving}
            style={{
              background: "#6b7280",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: 4,
            }}
          >
            Reset to Defaults
          </button>
          <button
            type='button'
            onClick={handleSave}
            disabled={saving}
            style={{
              background: "#059669",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: 4,
            }}
          >
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            color: "#dc2626",
            padding: 12,
            borderRadius: 4,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            color: "#059669",
            padding: 12,
            borderRadius: 4,
            marginBottom: 16,
          }}
        >
          {success}
        </div>
      )}

      <div
        style={{
          marginBottom: 16,
          padding: 12,
          background: "#f9fafb",
          borderRadius: 4,
        }}
      >
        <p style={{ margin: 0, fontSize: "0.9em", color: "#6b7280" }}>
          Configure which CSV column headers map to each field. Headers are
          matched case-insensitively. The first matching header found will be
          used. Drag headers to reorder priority.
        </p>
      </div>

      {fieldGroups.map((group) => (
        <div key={group.title} style={{ marginBottom: 24 }}>
          <h3
            style={{
              borderBottom: "2px solid #e5e7eb",
              paddingBottom: 8,
              marginBottom: 16,
              color: "#374151",
            }}
          >
            {group.title}
          </h3>

          {group.fields.map((field) => (
            <div
              key={field.key}
              style={{
                marginBottom: 20,
                padding: 16,
                border: "1px solid #e5e7eb",
                borderRadius: 4,
                background: "#fefefe",
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: "600",
                    marginBottom: 4,
                    color: "#374151",
                  }}
                >
                  {field.label}
                </label>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.85em",
                    color: "#6b7280",
                  }}
                >
                  {field.description}
                </p>
              </div>

              {(config[field.key] || []).map((header, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      minWidth: 24,
                      textAlign: "center",
                      fontSize: "0.8em",
                      color: "#6b7280",
                    }}
                  >
                    {index + 1}.
                  </span>
                  <input
                    type='text'
                    value={header}
                    onChange={(e) =>
                      updateHeaderOption(field.key, index, e.target.value)
                    }
                    placeholder='Enter CSV header name...'
                    style={{
                      flex: 1,
                      padding: "6px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: 4,
                      fontSize: "0.9em",
                    }}
                  />
                  <button
                    type='button'
                    onClick={() => removeHeaderOption(field.key, index)}
                    style={{
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      padding: "6px 10px",
                      borderRadius: 4,
                      fontSize: "0.8em",
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                type='button'
                onClick={() => addHeaderOption(field.key)}
                style={{
                  background: "#3b82f6",
                  color: "white",
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: 4,
                  fontSize: "0.85em",
                  cursor: "pointer",
                }}
              >
                + Add Header Option
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
