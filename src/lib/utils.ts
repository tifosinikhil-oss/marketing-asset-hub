import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function relativeTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const intervals: [number, string][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [2592000, "week"],
    [31536000, "month"],
  ];
  for (let i = 0; i < intervals.length; i++) {
    const [limit, label] = intervals[i];
    if (seconds < limit) {
      const value = Math.floor(seconds / (i === 0 ? 1 : intervals[i - 1][0]));
      return `${value} ${label}${value === 1 ? "" : "s"} ago`;
    }
  }
  return `${Math.floor(seconds / 31536000)} years ago`;
}
