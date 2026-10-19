// Formatting helpers shared by several pages.

// "2026-10-25" -> "25 Oct 2026". Parsed by hand to avoid time-zone shifts.
export function formatDate(isoDate) {
  if (!isoDate) return "-";
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// "10:30:00" -> "10:30"
export function formatTime(time) {
  return time ? time.slice(0, 5) : "-";
}

export function formatCurrency(amount) {
  const number = Number(amount);
  if (Number.isNaN(number)) return "-";
  return `₹${number.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const STATUS_LABELS = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const STATUS_COLORS = {
  SCHEDULED: "primary",
  COMPLETED: "success",
  CANCELLED: "secondary",
};

export const GENDER_LABELS = { M: "Male", F: "Female", O: "Other" };

// Today as "YYYY-MM-DD" in the browser's local time (used for <input type="date" min=...>).
export function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
