export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const OPD_ROSTER_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

interface FormatDateOptions {
  includeTime?: boolean;
  includeDate?: boolean;
}

export function formatDate(
  dateString: string | Date,
  options: FormatDateOptions = {},
): string {
  const { includeTime = false, includeDate = true } = options;

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();

  const formattedDate = `${day} ${month} ${year}`;

  if (includeTime) {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;

    if (!includeDate) {
      return `${displayHours}:${minutes} ${ampm}`;
    }

    return `${formattedDate}, ${displayHours}:${minutes} ${ampm}`;
  }

  return formattedDate;
}

export function timeAgo(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  if (diff < 60 * 1000) return "Just now";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m ago`;
  if (diff < 24 * 60 * 60 * 1000)
    return `${Math.floor(diff / (60 * 60 * 1000))}h ago`;
  return `${Math.floor(diff / (24 * 60 * 60 * 1000))}d ago`;
}

export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseFormDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatTime(timeString?: string): string {
  if (!timeString) return "";
  const [hours, minutes] = timeString.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const displayHours = h % 12 || 12;
  return `${displayHours.toString().padStart(2, "0")}:${minutes} ${ampm}`;
}

export function getRelativeTimeShort(dateString: string): string {
  const date = new Date(dateString);
  const time = date.getTime();
  if (!Number.isFinite(time)) return "";

  const diffSec = Math.max(0, Math.floor((Date.now() - time) / 1000));

  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo`;
  return `${Math.floor(diffMonth / 12)}y`;
}

export function getDateGroupLabel(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Earlier";

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const daysAgo = Math.floor(
    (startOfToday.getTime() - new Date(date).setHours(0, 0, 0, 0)) /
      (24 * 60 * 60 * 1000),
  );

  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return "Earlier this week";
  if (daysAgo < 30) return "Earlier this month";
  return "Older";
}

export function formatClock(value: string) {
  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return value;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

export function hasEndTimePassed({
  endTime,
  now = new Date(),
}: {
  endTime: string;
  now?: Date;
}) {
  const [hourRaw, minuteRaw] = endTime.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return false;
  const end = new Date(now);
  end.setHours(hour, minute, 0, 0);
  return now.getTime() > end.getTime();
}

export function hasTimePassed({
  time,
  now = new Date(),
}: {
  time: string;
  now?: Date;
}) {
  const [hourRaw, minuteRaw] = time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return false;
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  return now.getTime() >= target.getTime();
}

export function hasDatePassed(dateString?: string | null, now = new Date()) {
  if (!dateString) return false;

  const isoDay = /^(\d{4}-\d{2}-\d{2})/.exec(dateString)?.[1];
  if (isoDay) return isoDay < formatDateToISO(now);

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return false;
  return formatDateToISO(parsed) < formatDateToISO(now);
}
