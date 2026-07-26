export function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, 1)} KB`;
  return `${formatNumber(bytes / 1024 / 1024, 2)} MB`;
}

export function riskLevel(value: number) {
  if (value < 0.3) return { label: "Low", tone: "safe" as const };
  if (value < 0.6) return { label: "Review", tone: "warning" as const };
  return { label: "High", tone: "danger" as const };
}
