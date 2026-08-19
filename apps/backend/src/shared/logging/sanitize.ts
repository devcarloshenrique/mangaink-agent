const URL_PATTERN = /https?:\/\/[^\s"'<>`]+/gi
const SOURCE_ID_PATTERN = /src-[a-z0-9][\w-]*-[0-9a-f]{8}/gi
const CONVERSION_ID_PATTERN = /conv_\d+_[a-z0-9]{4}/gi
const JOB_ID_PATTERN = /job_\d+_[a-z0-9]{4}/gi

export function redactUrl(value: string): string {
  return String(value ?? '').replace(URL_PATTERN, '[url-redacted]')
}

export function sanitizeErrorMessage(message: string): string {
  return String(message ?? '')
    .replace(URL_PATTERN, '[url-redacted]')
    .replace(SOURCE_ID_PATTERN, 'src-[redacted]')
    .replace(CONVERSION_ID_PATTERN, 'conv-[redacted]')
    .replace(JOB_ID_PATTERN, 'job-[redacted]')
}
