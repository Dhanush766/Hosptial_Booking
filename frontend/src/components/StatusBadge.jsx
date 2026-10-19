import { STATUS_COLORS, STATUS_LABELS } from "../utils.js";

export default function StatusBadge({ status }) {
  return (
    <span className={`badge text-bg-${STATUS_COLORS[status] || "light"}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
