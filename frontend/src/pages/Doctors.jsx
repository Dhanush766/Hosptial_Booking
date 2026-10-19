import { useState } from "react";

import { api } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import FormModal from "../components/FormModal.jsx";
import Pagination from "../components/Pagination.jsx";
import Spinner from "../components/Spinner.jsx";
import { useToast } from "../components/Toasts.jsx";
import useDebounce from "../hooks/useDebounce.js";
import usePaginated from "../hooks/usePaginated.js";
import { formatCurrency } from "../utils.js";

const FIELDS = [
  { name: "full_name", label: "Full name", type: "text", required: true },
  { name: "email", label: "Email", type: "email", required: true },
  { name: "phone_number", label: "Phone number", type: "tel", required: true, help: "10 to 15 digits, e.g. +919876543210" },
  { name: "specialization", label: "Specialization", type: "text", required: true },
  { name: "experience_years", label: "Experience (years)", type: "number", required: true, min: 0, max: 60, col: 4 },
  { name: "consultation_fee", label: "Consultation fee", type: "number", required: true, min: 0.01, step: "0.01", col: 4 },
  { name: "is_available", label: "Available for appointments", type: "checkbox", col: 4 },
];

const EMPTY = {
  full_name: "",
  email: "",
  phone_number: "",
  specialization: "",
  experience_years: 0,
  consultation_fee: "",
  is_available: true,
};

export default function Doctors() {
  const { user } = useAuth();
  const notify = useToast();
  const [search, setSearch] = useState("");
  const [available, setAvailable] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // null | { record: object | null }
  const [toDelete, setToDelete] = useState(null);

  const debouncedSearch = useDebounce(search);
  const { data, loading, error, reload } = usePaginated("/doctors/", { search: debouncedSearch, available, page });

  async function save(values) {
    if (modal.record) {
      await api.patch(`/doctors/${modal.record.id}/`, values);
      notify("Doctor updated successfully.");
    } else {
      await api.post("/doctors/", values);
      notify("Doctor added successfully.");
    }
    setModal(null);
    reload();
  }

  async function remove() {
    try {
      await api.delete(`/doctors/${toDelete.id}/`);
      notify(`${toDelete.full_name} was deleted.`);
      if (data.results.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (err) {
      notify(err.message, "danger"); // e.g. the doctor still has appointments (409)
    }
    setToDelete(null);
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h1 className="h3 mb-0">Doctors</h1>
          <p className="text-muted mb-0">{data ? `${data.count} found` : "Loading..."}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setModal({ record: null })}>
          <i className="bi bi-plus-lg me-1" />
          Add Doctor
        </button>
      </div>

      <div className="card mb-3">
        <div className="card-body row g-2">
          <div className="col-md-8">
            <input
              className="form-control"
              placeholder="Search by name, specialization or email"
              aria-label="Search doctors"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="col-md-4">
            <select
              className="form-select"
              aria-label="Filter by availability"
              value={available}
              onChange={(event) => {
                setAvailable(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All doctors</option>
              <option value="true">Available</option>
              <option value="false">Not available</option>
            </select>
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
                  <th>Name</th>
                  <th>Specialization</th>
                  <th className="d-none d-md-table-cell">Experience</th>
                  <th className="d-none d-md-table-cell">Fee</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((doctor) => (
                  <tr key={doctor.id}>
                    <td>
                      <div className="fw-semibold">{doctor.full_name}</div>
                      <div className="small text-muted">{doctor.email}</div>
                    </td>
                    <td>{doctor.specialization}</td>
                    <td className="d-none d-md-table-cell">{doctor.experience_years} yrs</td>
                    <td className="d-none d-md-table-cell">{formatCurrency(doctor.consultation_fee)}</td>
                    <td>
                      <span className={`badge text-bg-${doctor.is_available ? "success" : "secondary"}`}>
                        {doctor.is_available ? "Available" : "Not available"}
                      </span>
                    </td>
                    <td className="text-end text-nowrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary me-1"
                        title="Edit"
                        onClick={() => setModal({ record: doctor })}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      {user.is_staff && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          title="Delete"
                          onClick={() => setToDelete(doctor)}
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
                      No doctors match your search.
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
          title={modal.record ? "Edit Doctor" : "Add Doctor"}
          fields={FIELDS}
          initial={modal.record ? { ...EMPTY, ...modal.record } : EMPTY}
          onSubmit={save}
          onClose={() => setModal(null)}
        />
      )}

      {toDelete && (
        <ConfirmModal
          title="Delete doctor"
          message={
            <>
              Are you sure you want to delete <strong>{toDelete.full_name}</strong>? This cannot be undone.
              Doctors who have appointments cannot be deleted.
            </>
          }
          confirmLabel="Yes, delete"
          onConfirm={remove}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  );
}
