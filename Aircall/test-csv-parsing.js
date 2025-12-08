// Test CSV parsing with the actual data
import { parseCsv, computeDailyMetrics } from "../src/services/metrics";
import fs from "fs";

async function testCsvParsing() {
  try {
    // Create a test file with some sample data from the CSV
    const testCsvContent = `line,datetime (tz offset incl.),number timezone,datetime (utc),country_code,direction,from,to,answered,missed_call_reason,user,duration (total),duration (in call),voicemail,recording,comments,tags,call quality,team,call direction - type,call start time,call end time,aircall number,customer number,in-call duration,call id,call type,waiting time,time to answer,time in ivr,call id (internal),disconnected by,ivr branch,ivr widget,call timeline,callback details,callback failure,automatic callback pending time,time with ai voice agent,entry number,ai voice agent transfer branch
Sales (Purchase Enquiry),2025-12-04 07:57:14,Etc/UTC,2025-12-04 07:57:14.083,AU,inbound,61413097129,61399174772,No,no_available_agent,[No associated user],217,,,,,,,Sales,Inbound - Missed,2025-12-04 18:57:14,2025-12-04 19:00:51,Sales (+61 3 9917 4772),+61 413 097 129,,CAfb1003122b9d444803befd7a069a3968,Missed,00:03:37,,00:01:02,3331525701,external,Sales,Sales or Support Prompt,https://dashboard.aircall.io/calls/3331525701/timeline,,,,,Sales (+61 3 9917 4772),
Sales (Purchase Enquiry),2025-12-04 07:53:35,Etc/UTC,2025-12-04 07:53:35,AU,inbound,61491214292,61399174772,Yes,,Deepak Joshi,530,486,,https://assets.aircall.io/calls/3331520692/recording,,New Orders Inquiry,,Sales,Inbound - Answered,2025-12-04 18:53:35,2025-12-04 19:02:25,Sales (+61 3 9917 4772),+61 491 214 292,00:08:06,CA67afaeaf9176af6b980887adfd2b4acb,Answered,00:00:44,00:00:29,00:00:15,3331520692,agent,Sales,Sales or Support Prompt,https://dashboard.aircall.io/calls/3331520692/timeline,,,,,Sales (+61 3 9917 4772),
Sales (Existing Order),2025-12-04 07:35:40,Etc/UTC,2025-12-04 07:35:40,AU,inbound,61451852174,61399175039,Yes,,Wayne Flavell,411,375,,https://assets.aircall.io/calls/3331499415/recording,,,,Sales,Inbound - Answered,2025-12-04 18:35:40,2025-12-04 18:42:31,Sales (+61 3 9917 5039),+61 451 852 174,00:06:15,CA0de4f54b9d623984ab3a088b24884014,Answered,00:00:36,00:00:30,00:00:06,3331499415,external,Sales,Sales or Support Prompt,https://dashboard.aircall.io/calls/3331499415/timeline,,,,,Sales (+61 3 9917 5039),
Aftershock PC,2025-12-04 18:33:54,Australia/Melbourne,2025-12-04 07:33:54,AU,outbound,61399173729,61419172075,Yes,,Jefferson Bala-an,198,191,,,,,,,Outbound,2025-12-04 18:33:54,2025-12-04 18:37:12,Aftershock PC (+61 3 9917 3729),+61 419 172 075,00:03:11,CA38db1967d29bbedc69e35c6a2b51190c,Outbound,00:00:07,,,3331497585,external,,,,,,,,,
Listed on Website - Ported number (5/17/21),2025-12-04 23:42:37,Australia/Melbourne,2025-12-04 12:42:37.034,AU,inbound,61447238588,61390433893,No,out_of_opening_hours,[No associated user],26,,,,,,,,Inbound - Out of business hours,2025-12-04 23:42:37,2025-12-04 23:43:03,Listed on Website (+61 3 9043 3893),+61 447 238 588,,CA3d7a8c3652b82eb20a96bfee061f5c9e,Out of business hours,00:00:26,,,3332594017,agent,,,https://dashboard.aircall.io/calls/3332594017/timeline,,,,,Listed on Website (+61 3 9043 3893),`;

    // Write test file
    fs.writeFileSync("test.csv", testCsvContent);

    // Parse the test file
    const file = new File([testCsvContent], "test.csv", { type: "text/csv" });
    const records = await parseCsv(file);
    const metrics = computeDailyMetrics(records);

    console.log("Parsed Records:", records.length);
    console.log("Metrics:", {
      inboundRaw: metrics.inboundRaw,
      inboundEffective: metrics.inboundEffective,
      outbound: metrics.outbound,
      answered: metrics.answered,
      missed: metrics.missed,
      categoryCounts: metrics.categoryCounts,
    });

    // Clean up
    fs.unlinkSync("test.csv");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run if this is being executed directly
if (require.main === module) {
  testCsvParsing();
}

export { testCsvParsing };
