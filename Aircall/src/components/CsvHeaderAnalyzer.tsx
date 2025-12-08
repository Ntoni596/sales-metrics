import React, { useState } from "react";
import Papa from "papaparse";
import { loadCsvConfig, findMatchingHeader } from "../services/csvConfig";

interface CsvPreviewProps {
  file: File | null;
  onHeaderAnalysis?: (analysis: HeaderAnalysis) => void;
}

interface HeaderAnalysis {
  availableHeaders: string[];
  mappedHeaders: Record<string, string | undefined>;
  unmappedHeaders: string[];
  missingCriticalFields: string[];
  sampleData: any[];
}

const CRITICAL_FIELDS = ["timestamp", "direction", "answered", "user"];

export function CsvHeaderAnalyzer({ file, onHeaderAnalysis }: CsvPreviewProps) {
  const [analysis, setAnalysis] = useState<HeaderAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeFile = async (csvFile: File) => {
    if (!csvFile) return;

    try {
      setLoading(true);
      setError(null);

      const text = await csvFile.text();
      const parsed = Papa.parse<Record<string, any>>(text, {
        header: true,
        skipEmptyLines: true,
        preview: 5, // Only parse first 5 rows for preview
      });

      if (parsed.errors.length) {
        throw new Error("CSV parse error: " + parsed.errors[0].message);
      }

      const availableHeaders = Object.keys(parsed.data[0] || {});
      const csvConfig = await loadCsvConfig();

      // Map each field type to found header
      const mappedHeaders: Record<string, string | undefined> = {};
      Object.entries(csvConfig).forEach(([fieldType, headerOptions]) => {
        const foundHeader = findMatchingHeader(availableHeaders, headerOptions);
        mappedHeaders[fieldType] = foundHeader;
      });

      // Find headers that weren't mapped to any field
      const mappedHeaderValues = Object.values(mappedHeaders).filter(Boolean);
      const unmappedHeaders = availableHeaders.filter(
        (h) => !mappedHeaderValues.includes(h)
      );

      // Check for missing critical fields
      const missingCriticalFields = CRITICAL_FIELDS.filter(
        (field) => !mappedHeaders[field]
      );

      const headerAnalysis: HeaderAnalysis = {
        availableHeaders,
        mappedHeaders,
        unmappedHeaders,
        missingCriticalFields,
        sampleData: parsed.data.slice(0, 3),
      };

      setAnalysis(headerAnalysis);
      onHeaderAnalysis?.(headerAnalysis);
    } catch (err: any) {
      setError(err.message || "Failed to analyze CSV");
    } finally {
      setLoading(false);
    }
  };

  // Auto-analyze when file changes
  React.useEffect(() => {
    if (file) {
      analyzeFile(file);
    } else {
      setAnalysis(null);
    }
  }, [file]);

  if (!file) {
    return null;
  }

  if (loading) {
    return (
      <div className='panel' style={{ padding: 16, marginTop: 16 }}>
        <div>Analyzing CSV headers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className='panel'
        style={{ padding: 16, marginTop: 16, borderColor: "#ef4444" }}
      >
        <div style={{ color: "#ef4444" }}>
          <strong>Analysis Error:</strong> {error}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className='panel' style={{ padding: 16, marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>CSV Header Analysis</h3>

      {analysis.missingCriticalFields.length > 0 && (
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
          <strong>Missing Critical Fields:</strong>{" "}
          {analysis.missingCriticalFields.join(", ")}
          <br />
          <small>
            These fields are required for proper parsing. Please configure the
            CSV headers in Settings.
          </small>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <h4 style={{ marginBottom: 8, color: "#059669" }}>
            ✓ Mapped Headers (
            {Object.values(analysis.mappedHeaders).filter(Boolean).length})
          </h4>
          <div style={{ maxHeight: 200, overflow: "auto", fontSize: "0.9em" }}>
            {Object.entries(analysis.mappedHeaders).map(([fieldType, header]) =>
              header ? (
                <div
                  key={fieldType}
                  style={{
                    padding: "4px 8px",
                    margin: "2px 0",
                    background: "#f0fdf4",
                    borderRadius: 4,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{fieldType}:</span>
                  <span style={{ fontFamily: "monospace" }}>{header}</span>
                </div>
              ) : null
            )}
          </div>
        </div>

        <div>
          <h4 style={{ marginBottom: 8, color: "#6b7280" }}>
            ? Unmapped Headers ({analysis.unmappedHeaders.length})
          </h4>
          <div style={{ maxHeight: 200, overflow: "auto", fontSize: "0.9em" }}>
            {analysis.unmappedHeaders.map((header) => (
              <div
                key={header}
                style={{
                  padding: "4px 8px",
                  margin: "2px 0",
                  background: "#f9fafb",
                  borderRadius: 4,
                  fontFamily: "monospace",
                }}
              >
                {header}
              </div>
            ))}
          </div>
        </div>
      </div>

      {analysis.sampleData.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4>Sample Data (first 3 rows)</h4>
          <div style={{ overflow: "auto", maxHeight: 300 }}>
            <table
              style={{
                width: "100%",
                fontSize: "0.8em",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  {analysis.availableHeaders.slice(0, 8).map((header) => (
                    <th
                      key={header}
                      style={{
                        padding: "6px 8px",
                        textAlign: "left",
                        borderBottom: "2px solid #e5e7eb",
                        background: analysis.mappedHeaders[
                          Object.keys(analysis.mappedHeaders).find(
                            (k) => analysis.mappedHeaders[k] === header
                          ) || ""
                        ]
                          ? "#f0fdf4"
                          : "#f9fafb",
                      }}
                    >
                      {header}
                    </th>
                  ))}
                  {analysis.availableHeaders.length > 8 && (
                    <th
                      style={{
                        padding: "6px 8px",
                        borderBottom: "2px solid #e5e7eb",
                      }}
                    >
                      ... +{analysis.availableHeaders.length - 8} more
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {analysis.sampleData.map((row, i) => (
                  <tr key={i}>
                    {analysis.availableHeaders.slice(0, 8).map((header) => (
                      <td
                        key={header}
                        style={{
                          padding: "4px 8px",
                          borderBottom: "1px solid #f3f4f6",
                          maxWidth: 120,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row[header]}
                      </td>
                    ))}
                    {analysis.availableHeaders.length > 8 && (
                      <td
                        style={{
                          padding: "4px 8px",
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        ...
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
