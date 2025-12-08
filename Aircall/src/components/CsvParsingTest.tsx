import React, { useState, useEffect } from "react";
import { parseCsv, computeDailyMetrics } from "../services/metrics";

const CsvParsingTest: React.FC = () => {
  const [testResults, setTestResults] = useState<any>(null);

  // Test data to produce expected results: 75 answered + 8 missed = 83 total inbound, 57 outbound
  const generateTestData = () => {
    const header = `line,datetime (tz offset incl.),number timezone,datetime (utc),country_code,direction,from,to,answered,missed_call_reason,user,duration (total),duration (in call),voicemail,recording,comments,tags,call quality,team,call direction - type,call start time,call end time,aircall number,customer number,in-call duration,call id,call type,waiting time,time to answer,time in ivr,call id (internal),disconnected by,ivr branch,ivr widget,call timeline,callback details,callback failure,automatic callback pending time,time with ai voice agent,entry number,ai voice agent transfer branch`;

    const rows = [];

    // Helper function to create a row with exactly 41 fields
    const createRow = (fields: string[]) => {
      // Ensure exactly 41 fields by padding with empty strings if needed
      while (fields.length < 41) {
        fields.push("");
      }
      return fields.slice(0, 41).join(",");
    };

    // Generate 75 answered inbound calls
    for (let i = 1; i <= 75; i++) {
      const category =
        i <= 10
          ? "New Orders Inquiry"
          : i <= 20
          ? "Progress update request"
          : "Sales (Purchase Enquiry)";
      const tag =
        i <= 10
          ? "New Orders Inquiry"
          : i <= 20
          ? "Progress update request"
          : "";

      rows.push(
        createRow([
          category, // line
          `2025-12-04 ${String(Math.floor(i / 10) + 7).padStart(
            2,
            "0"
          )}:${String((i * 7) % 60).padStart(2, "0")}:00`, // datetime (tz offset incl.)
          "Etc/UTC", // number timezone
          `2025-12-04 ${String(Math.floor(i / 10) + 7).padStart(
            2,
            "0"
          )}:${String((i * 7) % 60).padStart(2, "0")}:00`, // datetime (utc)
          "AU", // country_code
          "inbound", // direction
          `61${String(400000000 + i).padStart(9, "0")}`, // from
          "61399174772", // to
          "Yes", // answered
          "", // missed_call_reason
          `Agent ${(i % 5) + 1}`, // user
          `${300 + i * 2}`, // duration (total)
          `${280 + i * 2}`, // duration (in call)
          "", // voicemail
          `recording_${i}`, // recording
          "", // comments
          tag, // tags
          "", // call quality
          "Sales", // team
          "Inbound - Answered", // call direction - type
          `2025-12-04 ${String(Math.floor(i / 10) + 18).padStart(
            2,
            "0"
          )}:${String((i * 7) % 60).padStart(2, "0")}:00`, // call start time
          `2025-12-04 ${String(Math.floor(i / 10) + 18).padStart(
            2,
            "0"
          )}:${String((i * 7 + 5) % 60).padStart(2, "0")}:00`, // call end time
          "Sales (+61 3 9917 4772)", // aircall number
          `+61 ${String(400000000 + i).padStart(9, "0")}`, // customer number
          `${String(Math.floor((280 + i * 2) / 60)).padStart(2, "0")}:${String(
            (280 + i * 2) % 60
          ).padStart(2, "0")}`, // in-call duration
          `call_${i}_answered`, // call id
          "Answered", // call type
          `00:00:${String(5 + (i % 10)).padStart(2, "0")}`, // waiting time
          `00:00:${String(3 + (i % 7)).padStart(2, "0")}`, // time to answer
          `00:00:${String(2 + (i % 5)).padStart(2, "0")}`, // time in ivr
          `${3331500000 + i}`, // call id (internal)
          "agent", // disconnected by
          "Sales", // ivr branch
          "Sales or Support Prompt", // ivr widget
          `https://dashboard.aircall.io/calls/${3331500000 + i}/timeline`, // call timeline
          "", // callback details
          "", // callback failure
          "", // automatic callback pending time
          "", // time with ai voice agent
          "Sales (+61 3 9917 4772)", // entry number
          "", // ai voice agent transfer branch
        ])
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
        createRow([
          "Sales (Purchase Enquiry)", // line
          `2025-12-04 ${String(Math.floor(i / 10) + 7).padStart(
            2,
            "0"
          )}:${String((i * 7) % 60).padStart(2, "0")}:00`, // datetime (tz offset incl.)
          "Etc/UTC", // number timezone
          `2025-12-04 ${String(Math.floor(i / 10) + 7).padStart(
            2,
            "0"
          )}:${String((i * 7) % 60).padStart(2, "0")}:00`, // datetime (utc)
          "AU", // country_code
          "inbound", // direction
          `61${String(400000000 + i).padStart(9, "0")}`, // from
          "61399174772", // to
          "No", // answered
          reason, // missed_call_reason
          "[No associated user]", // user
          `${30 + i * 3}`, // duration (total)
          "0", // duration (in call)
          "", // voicemail
          "", // recording
          "", // comments
          "", // tags
          "", // call quality
          "Sales", // team
          "Inbound - Missed", // call direction - type
          `2025-12-04 ${String(Math.floor(i / 10) + 18).padStart(
            2,
            "0"
          )}:${String((i * 7) % 60).padStart(2, "0")}:00`, // call start time
          `2025-12-04 ${String(Math.floor(i / 10) + 18).padStart(
            2,
            "0"
          )}:${String((i * 7 + 2) % 60).padStart(2, "0")}:00`, // call end time
          "Sales (+61 3 9917 4772)", // aircall number
          `+61 ${String(400000000 + i).padStart(9, "0")}`, // customer number
          "", // in-call duration
          `call_${i}_missed`, // call id
          "Missed", // call type
          `00:00:${String(15 + (i % 10)).padStart(2, "0")}`, // waiting time
          "", // time to answer
          `00:00:${String(5 + (i % 8)).padStart(2, "0")}`, // time in ivr
          `${3331500000 + i}`, // call id (internal)
          "external", // disconnected by
          "Sales", // ivr branch
          "Sales or Support Prompt", // ivr widget
          `https://dashboard.aircall.io/calls/${3331500000 + i}/timeline`, // call timeline
          "", // callback details
          "", // callback failure
          "", // automatic callback pending time
          "", // time with ai voice agent
          "Sales (+61 3 9917 4772)", // entry number
          "", // ai voice agent transfer branch
        ])
      );
    }

    // Generate 57 outbound calls (all answered for simplicity)
    for (let i = 84; i <= 140; i++) {
      rows.push(
        createRow([
          "Aftershock PC", // line
          `2025-12-04 ${String(Math.floor(i / 10) + 7).padStart(
            2,
            "0"
          )}:${String((i * 5) % 60).padStart(2, "0")}:00`, // datetime (tz offset incl.)
          "Australia/Melbourne", // number timezone
          `2025-12-04 ${String(Math.floor(i / 10) + 7).padStart(
            2,
            "0"
          )}:${String((i * 5) % 60).padStart(2, "0")}:00`, // datetime (utc)
          "AU", // country_code
          "outbound", // direction
          "61399173729", // from
          `61${String(400000000 + i).padStart(9, "0")}`, // to
          "Yes", // answered
          "", // missed_call_reason
          `Agent ${((i - 83) % 3) + 1}`, // user
          `${180 + i * 2}`, // duration (total)
          `${160 + i * 2}`, // duration (in call)
          "", // voicemail
          "", // recording
          "", // comments
          "", // tags
          "", // call quality
          "", // team
          "Outbound", // call direction - type
          `2025-12-04 ${String(Math.floor(i / 10) + 18).padStart(
            2,
            "0"
          )}:${String((i * 5) % 60).padStart(2, "0")}:00`, // call start time
          `2025-12-04 ${String(Math.floor(i / 10) + 18).padStart(
            2,
            "0"
          )}:${String((i * 5 + 3) % 60).padStart(2, "0")}:00`, // call end time
          "Aftershock PC (+61 3 9917 3729)", // aircall number
          `+61 ${String(400000000 + i).padStart(9, "0")}`, // customer number
          `${String(Math.floor((160 + i * 2) / 60)).padStart(2, "0")}:${String(
            (160 + i * 2) % 60
          ).padStart(2, "0")}`, // in-call duration
          `call_${i}_outbound`, // call id
          "Outbound", // call type
          `00:00:${String(3 + (i % 7)).padStart(2, "0")}`, // waiting time
          "", // time to answer
          "00:00:01", // time in ivr
          `${3331500000 + i}`, // call id (internal)
          "external", // disconnected by
          "", // ivr branch
          "", // ivr widget
          `https://dashboard.aircall.io/calls/${3331500000 + i}/timeline`, // call timeline
          "", // callback details
          "", // callback failure
          "", // automatic callback pending time
          "", // time with ai voice agent
          "", // entry number
          "", // ai voice agent transfer branch
        ])
      );
    }

    return header + "\n" + rows.join("\n");
  };

  const testData = generateTestData();

  // Simple test data with just a few records to debug
  const simpleTestData = `line,datetime (tz offset incl.),number timezone,datetime (utc),country_code,direction,from,to,answered,missed_call_reason,user,duration (total),duration (in call),voicemail,recording,comments,tags,call quality,team,call direction - type,call start time,call end time,aircall number,customer number,in-call duration,call id,call type,waiting time,time to answer,time in ivr,call id (internal),disconnected by,ivr branch,ivr widget,call timeline,callback details,callback failure,automatic callback pending time,time with ai voice agent,entry number,ai voice agent transfer branch
New Orders Inquiry,2025-12-04 07:07:00,Etc/UTC,2025-12-04 07:07:00,AU,inbound,61400000001,61399174772,Yes,,Agent 1,302,282,,recording_1,,New Orders Inquiry,,Sales,Inbound - Answered,2025-12-04 18:07:00,2025-12-04 18:12:00,Sales (+61 3 9917 4772),+61 400000001,04:42,call_1_answered,Answered,00:00:05,00:00:03,00:00:02,3331500001,agent,Sales,Sales or Support Prompt,https://dashboard.aircall.io/calls/3331500001/timeline,,,,,Sales (+61 3 9917 4772),
Sales (Purchase Enquiry),2025-12-04 07:14:00,Etc/UTC,2025-12-04 07:14:00,AU,inbound,61400000002,61399174772,No,no_available_agent,[No associated user],33,0,,,,,,Sales,Inbound - Missed,2025-12-04 18:14:00,2025-12-04 18:16:00,Sales (+61 3 9917 4772),+61 400000002,,call_2_missed,Missed,00:00:15,,00:00:05,3331500002,external,Sales,Sales or Support Prompt,https://dashboard.aircall.io/calls/3331500002/timeline,,,,,Sales (+61 3 9917 4772),
Aftershock PC,2025-12-04 07:21:00,Australia/Melbourne,2025-12-04 07:21:00,AU,outbound,61399173729,61400000003,Yes,,Agent 1,186,166,,,,,,,Outbound,2025-12-04 18:21:00,2025-12-04 18:24:00,Aftershock PC (+61 3 9917 3729),+61 400000003,02:46,call_3_outbound,Outbound,00:00:03,,00:00:01,3331500003,external,,,https://dashboard.aircall.io/calls/3331500003/timeline,,,,,,`;

  useEffect(() => {
    const runTest = async () => {
      try {
        const blob = new Blob([testData], { type: "text/csv" });
        const file = new File([blob], "test.csv", { type: "text/csv" });

        const records = await parseCsv(file);
        console.log("Total parsed records:", records.length);
        console.log("Sample records:", records.slice(0, 5));
        console.log(
          "Record directions:",
          records.map((r) => r.direction)
        );
        console.log(
          "Record answered status:",
          records.map((r) => r.answered)
        );
        console.log(
          "Record timestamps:",
          records.map((r) => r.timestamp)
        );
        const metrics = computeDailyMetrics(records);
        console.log("Computed metrics:", metrics);

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
          rawRecords: records,
          debugInfo: {
            totalRecords: records.length,
            directions: records.map((r) => r.direction),
            answeredStatus: records.map((r) => r.answered),
            timestamps: records.map((r) => r.timestamp),
            users: records.map((r) => r.user),
            tags: records.map((r) => r.tags),
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
        <h3 className='font-semibold mb-2'>Debug Info</h3>
        <div className='bg-yellow-100 p-4 rounded text-sm'>
          <p>
            <strong>Parsing Debug:</strong>
          </p>
          <p>Records parsed: {testResults.recordCount}</p>
          {testResults.debugInfo && (
            <>
              <p>
                Directions: {JSON.stringify(testResults.debugInfo.directions)}
              </p>
              <p>
                Answered: {JSON.stringify(testResults.debugInfo.answeredStatus)}
              </p>
              <p>
                Timestamps: {JSON.stringify(testResults.debugInfo.timestamps)}
              </p>
              <p>Users: {JSON.stringify(testResults.debugInfo.users)}</p>
            </>
          )}
          {testResults.records && testResults.records.length > 0 && (
            <>
              <p>First record direction: {testResults.records[0]?.direction}</p>
              <p>
                First record answered:{" "}
                {testResults.records[0]?.answered ? "true" : "false"}
              </p>
              <p>First record timestamp: {testResults.records[0]?.timestamp}</p>
            </>
          )}
        </div>
      </div>

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
