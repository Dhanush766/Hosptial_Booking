import { useState } from "react";

// Confirmation dialog, used before deleting or cancelling.
// onConfirm may be async; the buttons are disabled while it runs.
export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  variant = "danger",
  onConfirm,
  onCancel,
}) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="modal-title h5">{title}</h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onCancel} disabled={busy} />
            </div>
            <div className="modal-body">{message}</div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={busy}>
                Go back
              </button>
              <button type="button" className={`btn btn-${variant}`} onClick={handleConfirm} disabled={busy}>
                {busy ? "Please wait..." : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
