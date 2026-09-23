export type ParsedUserAgent = {
  browser: string;
  os: string;
  device: "mobile" | "tablet" | "desktop" | "unknown";
  label: string;
};

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  const ua = userAgent?.trim() ?? "";
  if (!ua) {
    return { browser: "Unknown", os: "Unknown", device: "unknown", label: "Unknown client" };
  }

  const browser = matchBrowser(ua);
  const os = matchOs(ua);
  const device = matchDevice(ua);
  return {
    browser,
    os,
    device,
    label: `${browser} · ${os} · ${device}`,
  };
}

function matchBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}

function matchOs(ua: string): string {
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iOS/.test(ua)) return "iOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}

function matchDevice(ua: string): ParsedUserAgent["device"] {
  if (/iPad|Tablet/.test(ua)) return "tablet";
  if (/Mobile|iPhone|Android/.test(ua)) return "mobile";
  if (/Mozilla|Chrome|Safari|Firefox/.test(ua)) return "desktop";
  return "unknown";
}
