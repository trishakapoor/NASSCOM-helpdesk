export interface ParsedLog {
  errorType: string | null;
  errorCode: string | null;
  stackTrace: string[];
  summary: string;
}

export function parseLogFile(logContent: string): ParsedLog {
  const result: ParsedLog = {
    errorType: null,
    errorCode: null,
    stackTrace: [],
    summary: ""
  };

  if (!logContent) return result;

  const lines = logContent.split('\n').filter(l => l.trim().length > 0);
  
  const errorRegex = /(error|exception|panic|fatal|uncaught):\s*(.*)/i;
  const codeRegex = /\b(HTTP\s*\d{3}|[A-Z0-9_]+_ERROR|0x[0-9a-fA-F]+)\b/;
  const stackRegex = /^\s*at\s+/;

  let summaryParts: string[] = [];

  for (const line of lines) {
    const errorMatch = line.match(errorRegex);
    if (errorMatch && !result.errorType) {
      result.errorType = errorMatch[2].trim();
      summaryParts.push(`Key Error: ${result.errorType}`);
    }

    const codeMatch = line.match(codeRegex);
    if (codeMatch && !result.errorCode) {
      result.errorCode = codeMatch[1].trim();
      summaryParts.push(`Code: ${result.errorCode}`);
    }

    if (stackRegex.test(line)) {
      if (result.stackTrace.length < 5) {
        result.stackTrace.push(line.trim());
      }
    }
  }

  result.summary = summaryParts.join(' | ') + (result.stackTrace.length > 0 ? ` + ${result.stackTrace.length} stack frames` : '');
  
  return result;
}
