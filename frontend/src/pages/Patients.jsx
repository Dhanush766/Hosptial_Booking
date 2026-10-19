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
import { GENDER_LABELS, formatDate, todayIso } from "../utils.js";

const GENDER_OPTIONS = Object.entries(GENDER_LABELS).map(
  ([value, label]) => ({ value, label })
);

const EMPTY = {
  full_name: "",
  email: "",
  phone_number: "",
  date_of_birth: "",
  gender: "",
  address: "",
  medical_notes: "",
};

export default function Patients() {
  const { user } = useAuth();
  const notify = useToast();

  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const debouncedSearch = useDebounce(search);

  const { data, loading, error, reload } = usePaginated(
    "/patients/",
    {
      search: debouncedSearch,
      gender,
      page,
    }
  );

  const fields = [
    {
      name: "full_name",
      label: "Full name",
      type: "text",
      required: true,
    },
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
    },
    {
      name: "phone_number",
      label: "Phone number",
      type: "tel",
      required: true,
      help: "10 to 15 digits, e.g. +919876543210",
      col: 4,
    },
    {
      name: "date_of_birth",
      label: "Date of birth",
      type: "date",
      required: true,
      max: todayIso(),
      col: 6,
    },
    {
      name: "gender",
      label: "Gender",
      type: "select",
      required: true,
      options: GENDER_OPTIONS,
      col: 6,
    },
    {
      name: "address",
      label: "Address",
      type: "textarea",
      col: 12,
      rows: 2,
    },
    {
      name: "medical_notes",
      label: "Medical notes",
      type: "textarea",
      col: 12,
    },
  ];

  async function save(values) {
    if (modal.record) {
      await api.patch(`/patients/${modal.record.id}/`, values);
      notify("Patient updated successfully.");
    } else {
      await api.post("/patients/", values);
      notify("Patient added successfully.");
    }

    setModal(null);
    reload();
  }

  async function remove() {
    try {
      await api.delete(`/patients/${toDelete.id}/`);

      notify(`${toDelete.full_name} was deleted.`);

      if (data.results.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        reload();
      }
    } catch (err) {
      notify(err.message, "danger");
    }

    setToDelete(null);
  }

  return (
    <>
      {/* Page heading */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h1 className="h3 mb-0">Patients</h1>

          <p className="text-muted mb-0">
            {data ? `${data.count} found` : "Loading..."}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModal({ record: null })}
        >
          <i className="bi bi-person-plus me-1" />
          Add Patient
        </button>
      </div>

      {/* Search and gender filter */}
      <div className="card mb-3">
        <div className="card-body row g-2">
          <div className="col-md-8">
            <input
              className="form-control"
              placeholder="Search by name, email or phone"
              aria-label="Search patients"
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
              aria-label="Filter by gender"
              value={gender}
              onChange={(event) => {
                setGender(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All genders</option>

              {GENDER_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading and errors */}
      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {loading && !data && <Spinner />}

      {/* Patient table */}
      {data && (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Gender</th>
                  <th className="d-none d-md-table-cell">
                    Phone
                  </th>
                  <th className="d-none d-lg-table-cell">
                    Date of birth
                  </th>
                  <th className="text-end">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.results.map((patient) => (
                  <tr key={patient.id}>
                    <td>
                      <div className="fw-semibold">
                        {patient.full_name}
                      </div>

                      <div className="small text-muted">
                        {patient.email}
                      </div>
                    </td>

                    <td>
                      {GENDER_LABELS[patient.gender]}
                    </td>

                    <td className="d-none d-md-table-cell">
                      {patient.phone_number}
                    </td>

                    <td className="d-none d-lg-table-cell">
                      {formatDate(patient.date_of_birth)}
                    </td>

                    <td className="text-end text-nowrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary me-1"
                        title="Edit"
                        onClick={() =>
                          setModal({ record: patient })
                        }
                      >
                        <i className="bi bi-pencil" />
                      </button>

                      {user.is_staff && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          title="Delete"
                          onClick={() => setToDelete(patient)}
                        >
                          <i className="bi bi-trash" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {data.results.length === 0 && (
                  <tr>
                    <td
                      colSpan="5"
                      className="text-center text-muted py-5"
                    >
                      No patients match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {data && (
        <Pagination
          page={page}
          count={data.count}
          onChange={setPage}
        />
      )}

      {/* Add and edit patient modal */}
      {modal && (
        <FormModal
          title={
            modal.record ? "Edit Patient" : "Add Patient"
          }
          fields={fields}
          initial={
            modal.record
              ? { ...EMPTY, ...modal.record }
              : EMPTY
          }
          onSubmit={save}
          onClose={() => setModal(null)}
        />
      )}

      {/* Delete confirmation */}
      {toDelete && (
        <ConfirmModal
          title="Delete patient"
          message={
            <>
              Are you sure you want to delete{" "}
              <strong>{toDelete.full_name}</strong>?
              Patients who have appointments cannot be deleted.
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