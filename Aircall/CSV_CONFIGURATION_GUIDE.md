# CSV Header Configuration Guide

## Overview

The Aircall Performance Dashboard now supports **dynamic CSV header configuration**, allowing you to upload CSV files with any column structure without needing to modify your files or code.

## Key Features

### 🔧 Configurable Header Mapping

- **Settings Page**: Navigate to Settings → CSV Headers to configure mappings
- **40+ Supported Fields**: Complete coverage of Aircall export format
- **Case-Insensitive**: Headers matched regardless of capitalization
- **Priority-Based**: First matching header in priority list is used

### 🔍 Automatic Analysis

- **Header Detection**: Automatic identification of available headers in your CSV
- **Mapping Preview**: See which fields were successfully mapped
- **Missing Field Alerts**: Warnings for critical missing fields
- **Sample Data View**: Preview first few rows with mapping visualization

### 📊 Real-time Feedback

- **Parse Testing**: Test CSV parsing before importing
- **Error Reporting**: Clear messages when parsing fails
- **Configuration Help**: Guidance on fixing mapping issues

## Supported CSV Headers

### Core Fields (Required for functionality)

- **Timestamp**: `datetime (utc)`, `datetime (tz offset incl.)`, `Time`, `Timestamp`, `Date`, `call start time`
- **Direction**: `direction`, `Direction`, `call direction - type`
- **Answered Status**: `answered`, `Answered`, `Call Type`, `Call Status`, `Status`
- **Agent/User**: `user`, `Agent`, `User`, `Owner`, `Answered By`

### Call Details

- **Contact Info**: `country_code`, `from`, `to`, `customer number`
- **Duration**: `duration (total)`, `duration (in call)`, `in-call duration`, `waiting time`
- **Quality**: `call quality`, `voicemail`, `recording`
- **Classification**: `tags`, `call type`, `team`

### Technical Fields

- **System Data**: `call id`, `aircall number`, `call id (internal)`
- **IVR/Routing**: `time in ivr`, `ivr branch`, `ivr widget`, `disconnected by`
- **AI Features**: `time with ai voice agent`, `ai voice agent transfer branch`
- **Callbacks**: `callback details`, `callback failure`, `automatic callback pending time`

### New Aircall Fields

The system now supports all fields from the latest Aircall export format:

```
line, datetime (tz offset incl.), number timezone, datetime (utc), country_code,
direction, from, to, answered, missed_call_reason, user, duration (total),
duration (in call), voicemail, recording, comments, tags, call quality, team,
call direction - type, call start time, call end time, aircall number,
customer number, in-call duration, call id, call type, waiting time,
time to answer, time in ivr, call id (internal), disconnected by, ivr branch,
ivr widget, call timeline, callback details, callback failure,
automatic callback pending time, time with ai voice agent, entry number,
ai voice agent transfer branch
```

## Configuration Workflow

### 1. Upload Your CSV

- Use the standard file upload in Today or Bulk Import
- The system will analyze headers automatically
- Review the analysis results

### 2. Check Mapping Results

- **Green Section**: Successfully mapped headers
- **Gray Section**: Available but unmapped headers
- **Red Alerts**: Missing critical fields

### 3. Configure Mappings (if needed)

- Go to Settings → CSV Headers
- Add your specific header names to the appropriate field mappings
- Save configuration

### 4. Re-upload and Test

- Upload your CSV again to test the new mappings
- Use Settings → CSV Tester for detailed parsing analysis

## Examples

### Example 1: Standard Aircall Export

```csv
datetime (utc),direction,answered,user,waiting time,tags
2024-12-08T10:30:00,inbound,yes,John Smith,5,support
2024-12-08T11:15:00,inbound,no,Sarah Johnson,15,billing
```

✅ **Works automatically** - all headers recognized by default

### Example 2: Custom Headers

```csv
Call Date,Type,Status,Agent,Queue Time,Categories
2024-12-08T10:30:00,Inbound,Answered,John Smith,5,Support
2024-12-08T11:15:00,Inbound,Missed,Sarah Johnson,15,Billing
```

🔧 **Needs configuration**:

- Map "Call Date" → timestamp field
- Map "Type" → direction field
- Map "Status" → answered field
- Map "Agent" → user field
- Map "Queue Time" → waitTime field
- Map "Categories" → tags field

### Example 3: Mixed Format

```csv
timestamp,call_direction,answered_flag,agent_name,wait_seconds,call_tags
2024-12-08T10:30:00,IN,1,John Smith,5,support|technical
2024-12-08T11:15:00,IN,0,Sarah Johnson,15,billing
```

🔧 **Needs configuration**:

- Add "call_direction" to direction field mappings
- Add "answered_flag" to answered field mappings
- Add "agent_name" to user field mappings
- Add "wait_seconds" to waitTime field mappings
- Add "call_tags" to tags field mappings

## Best Practices

### For Administrators

1. **Set up mappings once** for your organization's CSV format
2. **Test with sample data** before processing large files
3. **Document your mappings** for team reference
4. **Use the CSV Tester** to validate changes

### For Users

1. **Check the format guide** before uploading
2. **Review analysis results** to ensure proper mapping
3. **Contact admin** if critical fields are missing
4. **Use consistent naming** in your CSV exports when possible

## Troubleshooting

### "No records found" Error

- **Cause**: No timestamp column detected
- **Solution**: Add your timestamp column name to the timestamp field mappings

### Missing Critical Fields Warning

- **Cause**: Required fields (timestamp, direction, answered, user) not mapped
- **Solution**: Configure mappings for your specific header names

### Parse Errors

- **Cause**: Invalid CSV format or encoding issues
- **Solution**: Ensure valid CSV format, UTF-8 encoding, proper escaping

### Incorrect Data Interpretation

- **Cause**: Headers mapped to wrong field types
- **Solution**: Review and adjust mappings in Settings → CSV Headers

## Technical Notes

### Header Matching Logic

1. **Exact Match**: Case-insensitive exact string match
2. **Priority Order**: Uses first matching header in configured priority list
3. **Fallback**: Automatic detection for common date/time patterns

### Data Processing

- **Tags**: Split on `,`, `;`, `|`, `/` characters
- **Durations**: Accepts seconds (numeric) or HH:MM:SS format
- **Answered**: Recognizes `yes`, `true`, `answered`, `completed`, `1`
- **Direction**: Keywords `in`/`out` detected in direction values

### Storage

- **Configuration**: Stored in Firestore `settings/csv-header-config`
- **User-specific**: Settings shared across organization
- **Backup**: Default mappings always available as fallback
