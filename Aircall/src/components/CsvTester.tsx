import { useState } from "react";
import { parseCsv } from "../services/metrics";
import { CsvHeaderAnalyzer } from "./CsvHeaderAnalyzer";
import { CsvFormatGuide } from "./CsvFormatGuide";

export function CsvTester() {
  const [file, setFile] = useState<File | null>(null);
  const [parseResults, setParseResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (uploadedFile: File) => {
    setFile(uploadedFile);
    setParseResults(null);
    setError(null);
  };

  const testParsing = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const records = await parseCsv(file);
      setParseResults({
        recordCount: records.length,
        sampleRecords: records.slice(0, 5),
        fields: Object.keys(records[0] || {}),
        firstRecord: records[0],
      });
    } catch (err: any) {
      setError(err.message || "Failed to parse CSV");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>CSV Parser Tester</h2>
      <p style={{ color: "#6b7280", marginBottom: 20 }}>
        Upload a CSV file to test the parsing logic and see how the configurable
        headers work.
      </p>

      <CsvFormatGuide />

      <div className='panel' style={{ padding: 16 }}>
        <h3>Upload Test CSV</h3>
        <div style={{ marginBottom: 16 }}>
          <input
            type='file'
            accept='.csv,text/csv'
            onChange={(e) => {
              const uploadedFile = e.target.files?.[0];
              if (uploadedFile) {
                handleFileUpload(uploadedFile);
              }
            }}
          />
          {file && (
            <button
              onClick={testParsing}
              disabled={loading}
              style={{
                marginLeft: 12,
                padding: "8px 16px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              {loading ? "Parsing..." : "Test Parse"}
            </button>
          )}
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
            <strong>Parse Error:</strong> {error}
          </div>
        )}

        {parseResults && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ color: "#059669" }}>✓ Parse Successful!</h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              <div
                style={{ background: "#f0fdf4", padding: 12, borderRadius: 4 }}
              >
                <strong>Records Found:</strong> {parseResults.recordCount}
              </div>
              <div
                style={{ background: "#f0f9ff", padding: 12, borderRadius: 4 }}
              >
                <strong>Fields Detected:</strong> {parseResults.fields.length}
              </div>
            </div>

            <h5 style={{ marginTop: 20 }}>First Record Structure:</h5>
            <pre
              style={{
                background: "#1f2937",
                color: "#f3f4f6",
                padding: 12,
                borderRadius: 4,
                overflow: "auto",
                fontSize: "0.85em",
              }}
            >
              {JSON.stringify(parseResults.firstRecord, null, 2)}
            </pre>

            <h5 style={{ marginTop: 20 }}>
              Sample Records ({parseResults.sampleRecords.length} of{" "}
              {parseResults.recordCount}):
            </h5>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  fontSize: "0.8em",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr>
                    {parseResults.fields.map((field: string) => (
                      <th
                        key={field}
                        style={{
                          padding: "8px 12px",
                          textAlign: "left",
                          borderBottom: "2px solid #e5e7eb",
                          background: "#f9fafb",
                          fontWeight: 600,
                        }}
                      >
                        {field}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parseResults.sampleRecords.map((record: any, i: number) => (
                    <tr key={i}>
                      {parseResults.fields.map((field: string) => (
                        <td
                          key={field}
                          style={{
                            padding: "6px 12px",
                            borderBottom: "1px solid #f3f4f6",
                            maxWidth: 150,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {String(record[field] || "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <CsvHeaderAnalyzer file={file} />
    </div>
  );
}
