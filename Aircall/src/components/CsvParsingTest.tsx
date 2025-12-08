import React, { useState, useEffect } from "react";
import { parseCsv, computeDailyMetrics } from "../services/metrics";

const CsvParsingTest: React.FC = () => {
  const [testResults, setTestResults] = useState<any>(null);

  // Test data to produce expected results: 75 answered + 8 missed = 83 total inbound, 57 outbound
  const generateTestData = () => {
    const header = `line,datetime (tz offset incl.),number timezone,datetime (utc),country_code,direction,from,to,answered,missed_call_reason,user,duration (total),duration (in call),voicemail,recording,comments,tags,call quality,team,call direction - type,call start time,call end time,aircall number,customer number,in-call duration,call id,call type,waiting time,time to answer,time in ivr,call id (internal),disconnected by,ivr branch,ivr widget,call timeline,callback details,callback failure,automatic callback pending time,time with ai voice agent,entry number,ai voice agent transfer branch`;

    const rows = [];

    // Generate 75 answered inbound calls
    for (let i = 1; i <= 75; i++) {
      const category =
        i <= 10
          ? "New Orders Inquiry"
          : i <= 20
          ? "Progress update request"
          : "Sales (Purchase Enquiry)";
      rows.push(
        `${category},2025-12-04 ${String(Math.floor(i / 10) + 7).padStart(
          2,
          "0"
        )}:${String((i * 7) % 60).padStart(
          2,
          "0"
        )}:00,Etc/UTC,2025-12-04 ${String(Math.floor(i / 10) + 7).padStart(
          2,
          "0"
        )}:${String((i * 7) % 60).padStart(2, "0")}:00,AU,inbound,61${String(
          400000000 + i
        ).padStart(9, "0")},61399174772,Yes,,Agent ${(i % 5) + 1},${
          300 + i * 2
        },${280 + i * 2},,recording_${i},,${
          i <= 10
            ? "New Orders Inquiry"
            : i <= 20
            ? "Progress update request"
            : ""
        },,Sales,Inbound - Answered,2025-12-04 ${String(
          Math.floor(i / 10) + 18
        ).padStart(2, "0")}:${String((i * 7) % 60).padStart(
          2,
          "0"
        )}:00,2025-12-04 ${String(Math.floor(i / 10) + 18).padStart(
          2,
          "0"
        )}:${String((i * 7 + 5) % 60).padStart(
          2,
          "0"
        )}:00,Sales (+61 3 9917 4772),+61 ${String(400000000 + i).padStart(
          9,
          "0"
        )},${String(Math.floor((280 + i * 2) / 60)).padStart(2, "0")}:${String(
          (280 + i * 2) % 60
        ).padStart(2, "0")},call_${i}_answered,Answered,00:00:${String(
          5 + (i % 10)
        ).padStart(2, "0")},00:00:${String(3 + (i % 7)).padStart(
          2,
          "0"
        )},00:00:${String(2 + (i % 5)).padStart(2, "0")},${
          3331500000 + i
        },agent,Sales,Sales or Support Prompt,https://dashboard.aircall.io/calls/${
          3331500000 + i
        }/timeline,,,,,Sales (+61 3 9917 4772),`
      );
    }

    // Generate 8 missed inbound calls with different reasons
    const missedReasons = [
      "no_available_agent",
      "agents_did_not_answer",
      "out_of_opening_hours",
      "abandoned_in_ivr",
      "short_abandoned",
    ];
    for (let i = 76; i <= 83; i++) {
      const reason = missedReasons[(i - 76) % missedReasons.length];
      rows.push(
        `Sales (Purchase Enquiry),2025-12-04 ${String(
          Math.floor(i / 10) + 7
        ).padStart(2, "0")}:${String((i * 7) % 60).padStart(
          2,
          "0"
        )}:00,Etc/UTC,2025-12-04 ${String(Math.floor(i / 10) + 7).padStart(
          2,
          "0"
        )}:${String((i * 7) % 60).padStart(2, "0")}:00,AU,inbound,61${String(
          400000000 + i
        ).padStart(9, "0")},61399174772,No,${reason},[No associated user],${
          30 + i * 3
        },0,,,,,,,Sales,Inbound - Missed,2025-12-04 ${String(
          Math.floor(i / 10) + 18
        ).padStart(2, "0")}:${String((i * 7) % 60).padStart(
          2,
          "0"
        )}:00,2025-12-04 ${String(Math.floor(i / 10) + 18).padStart(
          2,
          "0"
        )}:${String((i * 7 + 2) % 60).padStart(
          2,
          "0"
        )}:00,Sales (+61 3 9917 4772),+61 ${String(400000000 + i).padStart(
          9,
          "0"
        )},,call_${i}_missed,Missed,00:00:${String(15 + (i % 10)).padStart(
          2,
          "0"
        )},,00:00:${String(5 + (i % 8)).padStart(2, "0")},${
          3331500000 + i
        },external,Sales,Sales or Support Prompt,https://dashboard.aircall.io/calls/${
          3331500000 + i
        }/timeline,,,,,Sales (+61 3 9917 4772),`
      );
    }

    // Generate 57 outbound calls (all answered for simplicity)
    for (let i = 84; i <= 140; i++) {
      rows.push(
        `Aftershock PC,2025-12-04 ${String(Math.floor(i / 10) + 7).padStart(
          2,
          "0"
        )}:${String((i * 5) % 60).padStart(
          2,
          "0"
        )}:00,Australia/Melbourne,2025-12-04 ${String(
          Math.floor(i / 10) + 7
        ).padStart(2, "0")}:${String((i * 5) % 60).padStart(
          2,
          "0"
        )}:00,AU,outbound,61399173729,61${String(400000000 + i).padStart(
          9,
          "0"
        )},Yes,,Agent ${((i - 83) % 3) + 1},${180 + i * 2},${
          160 + i * 2
        },,,,,,,Outbound,2025-12-04 ${String(Math.floor(i / 10) + 18).padStart(
          2,
          "0"
        )}:${String((i * 5) % 60).padStart(2, "0")}:00,2025-12-04 ${String(
          Math.floor(i / 10) + 18
        ).padStart(2, "0")}:${String((i * 5 + 3) % 60).padStart(
          2,
          "0"
        )}:00,Aftershock PC (+61 3 9917 3729),+61 ${String(
          400000000 + i
        ).padStart(9, "0")},${String(Math.floor((160 + i * 2) / 60)).padStart(
          2,
          "0"
        )}:${String((160 + i * 2) % 60).padStart(
          2,
          "0"
        )},call_${i}_outbound,Outbound,00:00:${String(3 + (i % 7)).padStart(
          2,
          "0"
        )},,00:00:01,${
          3331500000 + i
        },external,,,https://dashboard.aircall.io/calls/${
          3331500000 + i
        }/timeline,,,,,,`
      );
    }

    return header + "\n" + rows.join("\n");
  };

  const testData = generateTestData();

  useEffect(() => {
    const runTest = async () => {
      try {
        const blob = new Blob([testData], { type: "text/csv" });
        const file = new File([blob], "test.csv", { type: "text/csv" });

        const records = await parseCsv(file);
        const metrics = computeDailyMetrics(records);

        setTestResults({
          recordCount: records.length,
          inboundRaw: metrics.inboundRaw,
          inboundEffective: metrics.inboundEffective,
          outbound: metrics.outbound,
          answered: metrics.answered,
          missed: metrics.missed,
          categoryCounts: metrics.categoryCounts,
          expectedResults: {
            inboundEffective: 83,
            answered: 75,
            missed: 8,
            outbound: 57,
            missedPercentage: ((8 / 83) * 100).toFixed(1),
          },
          records: records.slice(0, 10).map((r) => ({
            timestamp: r.timestamp,
            direction: r.direction,
            answered: r.answered,
            missedReason: r.missedReason,
            tags: r.tags.join(", "),
            user: r.user,
          })),
        });
      } catch (error) {
        console.error("Test failed:", error);
        setTestResults({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    runTest();
  }, []);

  if (!testResults) {
    return <div>Running CSV parsing test...</div>;
  }

  if (testResults.error) {
    return <div>Test Error: {testResults.error}</div>;
  }

  return (
    <div className='p-6'>
      <h2 className='text-xl font-bold mb-4'>CSV Parsing Test Results</h2>

      <div className='mb-6'>
        <h3 className='font-semibold mb-2'>Metrics Summary</h3>
        <div className='bg-gray-100 p-4 rounded'>
          <p>Total Records: {testResults.recordCount}</p>
          <p>Inbound Raw: {testResults.inboundRaw}</p>
          <p>
            Inbound Effective: {testResults.inboundEffective}{" "}
            <span
              className={
                testResults.inboundEffective ===
                testResults.expectedResults.inboundEffective
                  ? "text-green-600"
                  : "text-red-600"
              }
            >
              (
              {testResults.inboundEffective ===
              testResults.expectedResults.inboundEffective
                ? "✓"
                : "✗"}{" "}
              Expected: {testResults.expectedResults.inboundEffective})
            </span>
          </p>
          <p>
            Outbound: {testResults.outbound}{" "}
            <span
              className={
                testResults.outbound === testResults.expectedResults.outbound
                  ? "text-green-600"
                  : "text-red-600"
              }
            >
              (
              {testResults.outbound === testResults.expectedResults.outbound
                ? "✓"
                : "✗"}{" "}
              Expected: {testResults.expectedResults.outbound})
            </span>
          </p>
          <p>
            Answered: {testResults.answered}{" "}
            <span
              className={
                testResults.answered === testResults.expectedResults.answered
                  ? "text-green-600"
                  : "text-red-600"
              }
            >
              (
              {testResults.answered === testResults.expectedResults.answered
                ? "✓"
                : "✗"}{" "}
              Expected: {testResults.expectedResults.answered})
            </span>
          </p>
          <p>
            Missed: {testResults.missed}{" "}
            <span
              className={
                testResults.missed === testResults.expectedResults.missed
                  ? "text-green-600"
                  : "text-red-600"
              }
            >
              (
              {testResults.missed === testResults.expectedResults.missed
                ? "✓"
                : "✗"}{" "}
              Expected: {testResults.expectedResults.missed})
            </span>
          </p>
          <p>
            Missed %:{" "}
            {(
              (testResults.missed / (testResults.inboundEffective || 1)) *
              100
            ).toFixed(1)}
            %{" "}
            <span
              className={
                Math.abs(
                  (testResults.missed / (testResults.inboundEffective || 1)) *
                    100 -
                    parseFloat(testResults.expectedResults.missedPercentage)
                ) < 0.1
                  ? "text-green-600"
                  : "text-red-600"
              }
            >
              (
              {Math.abs(
                (testResults.missed / (testResults.inboundEffective || 1)) *
                  100 -
                  parseFloat(testResults.expectedResults.missedPercentage)
              ) < 0.1
                ? "✓"
                : "✗"}{" "}
              Expected: {testResults.expectedResults.missedPercentage}%)
            </span>
          </p>
        </div>
      </div>

      <div className='mb-6'>
        <h3 className='font-semibold mb-2'>Category Counts</h3>
        <div className='bg-gray-100 p-4 rounded'>
          {Object.entries(testResults.categoryCounts).map(
            ([category, count]) => (
              <p key={category}>
                {category}: {count as number}
              </p>
            )
          )}
        </div>
      </div>

      <div>
        <h3 className='font-semibold mb-2'>Sample Records (First 10)</h3>
        <div className='overflow-x-auto'>
          <table className='min-w-full bg-white border'>
            <thead>
              <tr>
                <th className='px-4 py-2 border'>Timestamp</th>
                <th className='px-4 py-2 border'>Direction</th>
                <th className='px-4 py-2 border'>Answered</th>
                <th className='px-4 py-2 border'>Missed Reason</th>
                <th className='px-4 py-2 border'>Tags</th>
                <th className='px-4 py-2 border'>User</th>
              </tr>
            </thead>
            <tbody>
              {testResults.records.map((record: any, index: number) => (
                <tr key={index}>
                  <td className='px-4 py-2 border'>{record.timestamp}</td>
                  <td className='px-4 py-2 border'>{record.direction}</td>
                  <td className='px-4 py-2 border'>
                    {record.answered ? "Yes" : "No"}
                  </td>
                  <td className='px-4 py-2 border'>
                    {record.missedReason || "-"}
                  </td>
                  <td className='px-4 py-2 border'>{record.tags}</td>
                  <td className='px-4 py-2 border'>{record.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CsvParsingTest;
