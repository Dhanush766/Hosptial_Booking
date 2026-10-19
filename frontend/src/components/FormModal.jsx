import { useState } from "react";

import { ApiError } from "../api.js";

// A reusable add/edit dialog driven by a list of field descriptions:
//   { name, label, type, required, options, col, help, min, max, step, rows }
// type is one of: text, email, tel, number, date, time, select, textarea, checkbox.
// onSubmit(values) must throw an ApiError when the server rejects the data; the
// per-field messages sent by Django REST Framework are shown under each field.
export default function FormModal({ title, fields, initial, onSubmit, onClose }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function change(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError("");
    try {
      await onSubmit(values);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && error.data && typeof error.data === "object") {
        setErrors(error.data);
        const general = error.data.non_field_errors || error.data.detail;
        setFormError(general ? String(general) : "Please correct the highlighted fields.");
      } else {
        setFormError(error.message || "Something went wrong.");
      }
      setSaving(false);
    }
  }

  function renderInput(field) {
    const invalid = errors[field.name] ? "is-invalid" : "";
    const common = {
      id: `field-${field.name}`,
      name: field.name,
      required: field.required,
    };

    if (field.type === "checkbox") {
      return (
        <div className="form-check form-switch mt-2">
          <input
            {...common}
            required={false}
            type="checkbox"
            className="form-check-input"
            checked={Boolean(values[field.name])}
            onChange={(event) => change(field.name, event.target.checked)}
          />
          <label className="form-check-label" htmlFor={common.id}>
            {field.label}
          </label>
        </div>
      );
    }
    if (field.type === "select") {
      return (
        <select
          {...common}
          className={`form-select ${invalid}`}
          value={values[field.name] ?? ""}
          onChange={(event) => change(field.name, event.target.value)}
        >
          <option value="">{field.placeholder || "Select..."}</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === "textarea") {
      return (
        <textarea
          {...common}
          rows={field.rows || 3}
          className={`form-control ${invalid}`}
          value={values[field.name] ?? ""}
          onChange={(event) => change(field.name, event.target.value)}
        />
      );
    }
    return (
      <input
        {...common}
        type={field.type}
        min={field.min}
        max={field.max}
        step={field.step}
        className={`form-control ${invalid}`}
        value={values[field.name] ?? ""}
        onChange={(event) => change(field.name, event.target.value)}
      />
    );
  }

  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true" style={{ overflowY: "auto" }}>
        <div className="modal-dialog modal-lg">
          <form className="modal-content" onSubmit={handleSubmit} noValidate>
            <div className="modal-header">
              <h2 className="modal-title h5">{title}</h2>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={saving} />
            </div>
            <div className="modal-body">
              {formError && (
                <div className="alert alert-danger py-2" role="alert">
                  {formError}
                </div>
              )}
              <div className="row g-3">
                {fields.map((field) => (
                  <div key={field.name} className={`col-12 col-md-${field.col || 6}`}>
                    {field.type !== "checkbox" && (
                      <label htmlFor={`field-${field.name}`} className="form-label">
                        {field.label}
                        {field.required && <span className="text-danger"> *</span>}
                      </label>
                    )}
                    {renderInput(field)}
                    {[].concat(errors[field.name] || []).map((message) => (
                      <div key={message} className="invalid-feedback d-block">
                        {message}
                      </div>
                    ))}
                    {field.help && <div className="form-text">{field.help}</div>}
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
