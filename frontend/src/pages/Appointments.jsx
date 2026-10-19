import { useEffect, useState } from "react";

import { api } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import FormModal from "../components/FormModal.jsx";
import Pagination from "../components/Pagination.jsx";
import Spinner from "../components/Spinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../components/Toasts.jsx";
import useDebounce from "../hooks/useDebounce.js";
import usePaginated from "../hooks/usePaginated.js";
import { STATUS_LABELS, formatDate, formatTime, todayIso } from "../utils.js";

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

const EMPTY = {
  patient: "",
  doctor: "",
  appointment_date: "",
  appointment_time: "",
  reason: "",
  notes: "",
  status: "SCHEDULED",
};

export default function Appointments() {
  const { user } = useAuth();
  const notify = useToast();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [doctor, setDoctor] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState(null); // null | { record: object | null }
  const [pending, setPending] = useState(null); // { kind: "cancel" | "delete", item }
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);

  const debouncedSearch = useDebounce(search);
  const { data, loading, error, reload } = usePaginated("/appointments/", {
    search: debouncedSearch,
    status,
    doctor,
    date,
    page,
  });

  // Doctors and patients fill the drop-downs (the API allows up to 100 per request).
  useEffect(() => {
    api.get("/doctors/", { page_size: 100 }).then((d) => setDoctors(d.results)).catch(() => {});
    api.get("/patients/", { page_size: 100 }).then((d) => setPatients(d.results)).catch(() => {});
  }, []);

  const doctorOptions = doctors.map((d) => ({
    value: d.id,
    label: `${d.full_name} - ${d.specialization}${d.is_available ? "" : " (not available)"}`,
  }));
  const patientOptions = patients.map((p) => ({ value: p.id, label: p.full_name }));

  const editing = Boolean(modal && modal.record);
  const fields = [
    { name: "patient", label: "Patient", type: "select", required: true, options: patientOptions, placeholder: "Select a patient" },
    { name: "doctor", label: "Doctor", type: "select", required: true, options: doctorOptions, placeholder: "Select a doctor" },
    { name: "appointment_date", label: "Date", type: "date", required: true, min: editing ? undefined : todayIso(), col: 4 },
    { name: "appointment_time", label: "Time", type: "time", required: true, min: "09:00", max: "18:00", step: 900, col: 4, help: "Appointment hours: 09:00 - 18:00" },
    ...(editing ? [{ name: "status", label: "Status", type: "select", required: true, options: STATUS_OPTIONS, col: 4 }] : []),
    { name: "reason", label: "Reason for visit", type: "text", required: true, col: 12 },
    { name: "notes", label: "Notes", type: "textarea", col: 12, rows: 2 },
  ];

  function resetPage(setter) {
    return (event) => {
      setter(event.target.value);
      setPage(1);
    };
  }

  function initialValues() {
    if (!editing) return EMPTY;
    const record = modal.record;
    return { ...EMPTY, ...record, appointment_time: formatTime(record.appointment_time) };
  }

  async function save(values) {
    const payload = {
      patient: values.patient,
      doctor: values.doctor,
      appointment_date: values.appointment_date,
      appointment_time: values.appointment_time,
      reason: values.reason,
      notes: values.notes,
    };
    if (editing) {
      payload.status = values.status;
      await api.patch(`/appointments/${modal.record.id}/`, payload);
      notify("Appointment updated successfully.");
    } else {
      await api.post("/appointments/", payload);
      notify("Appointment booked successfully.");
    }
    setModal(null);
    reload();
  }

  async function markCompleted(item) {
    try {
      await api.patch(`/appointments/${item.id}/`, { status: "COMPLETED" });
      notify("Appointment marked as completed.");
      reload();
    } catch (err) {
      notify(err.message, "danger");
    }
  }

  async function confirmPending() {
    const { kind, item } = pending;
    try {
      if (kind === "cancel") {
        await api.patch(`/appointments/${item.id}/`, { status: "CANCELLED" });
        notify("Appointment cancelled.");
        reload();
      } else {
        await api.delete(`/appointments/${item.id}/`);
        notify("Appointment deleted.");
        if (data.results.length === 1 && page > 1) setPage(page - 1);
        else reload();
      }
    } catch (err) {
      notify(err.message, "danger");
    }
    setPending(null);
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h1 className="h3 mb-0">Appointments</h1>
          <p className="text-muted mb-0">{data ? `${data.count} found` : "Loading..."}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setModal({ record: null })}>
          <i className="bi bi-calendar-plus me-1" />
          Book Appointment
        </button>
      </div>

      <div className="card mb-3">
        <div className="card-body row g-2">
          <div className="col-md-3">
            <input
              className="form-control"
              placeholder="Search patient, doctor, reason"
              aria-label="Search appointments"
              value={search}
              onChange={resetPage(setSearch)}
            />
          </div>
          <div className="col-md-3">
            <select className="form-select" aria-label="Filter by status" value={status} onChange={resetPage(setStatus)}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <select className="form-select" aria-label="Filter by doctor" value={doctor} onChange={resetPage(setDoctor)}>
              <option value="">All doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3 d-flex gap-2">
            <input type="date" className="form-control" aria-label="Filter by date" value={date} onChange={resetPage(setDate)} />
            <button
              type="button"
              className="btn btn-outline-secondary"
              title="Reset filters"
              onClick={() => {
                setSearch("");
                setStatus("");
                setDoctor("");
                setDate("");
                setPage(1);
              }}
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {loading && !data && <Spinner />}

      {data && (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>When</th>
                  <th>Patient</th>
                  <th className="d-none d-md-table-cell">Doctor</th>
                  <th className="d-none d-lg-table-cell">Reason</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((item) => (
                  <tr key={item.id}>
                    <td className="text-nowrap">
                      {formatDate(item.appointment_date)}
                      <div className="small text-muted">{formatTime(item.appointment_time)}</div>
                    </td>
                    <td>{item.patient_name}</td>
                    <td className="d-none d-md-table-cell">
                      {item.doctor_name}
                      <div className="small text-muted">{item.doctor_specialization}</div>
                    </td>
                    <td className="d-none d-lg-table-cell">{item.reason}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="text-end text-nowrap">
                      {item.status === "SCHEDULED" && (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success me-1"
                            title="Mark as completed"
                            onClick={() => markCompleted(item)}
                          >
                            <i className="bi bi-check2-circle" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning me-1"
                            title="Cancel appointment"
                            onClick={() => setPending({ kind: "cancel", item })}
                          >
                            <i className="bi bi-x-circle" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary me-1"
                        title="Edit"
                        onClick={() => setModal({ record: item })}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      {user.is_staff && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          title="Delete"
                          onClick={() => setPending({ kind: "delete", item })}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.results.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center text-muted py-5">
                      No appointments match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && <Pagination page={page} count={data.count} onChange={setPage} />}

      {modal && (
        <FormModal
          title={editing ? "Edit Appointment" : "Book Appointment"}
          fields={fields}
          initial={initialValues()}
          onSubmit={save}
          onClose={() => setModal(null)}
        />
      )}

      {pending && (
        <ConfirmModal
          title={pending.kind === "cancel" ? "Cancel appointment" : "Delete appointment"}
          message={
            <>
              {pending.kind === "cancel" ? "Cancel" : "Permanently delete"} the appointment of{" "}
              <strong>{pending.item.patient_name}</strong> with <strong>{pending.item.doctor_name}</strong> on{" "}
              {formatDate(pending.item.appointment_date)} at {formatTime(pending.item.appointment_time)}?
            </>
          }
          confirmLabel={pending.kind === "cancel" ? "Yes, cancel it" : "Yes, delete"}
          variant={pending.kind === "cancel" ? "warning" : "danger"}
          onConfirm={confirmPending}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  );
}
