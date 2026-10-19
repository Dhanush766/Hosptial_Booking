import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api.js";
import Spinner from "../components/Spinner.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { STATUS_LABELS, formatDate, formatTime } from "../utils.js";

function StatCard({ label, value, hint, color }) {
  return (
    <div className="col-6 col-lg-3">
      <div className={`card border-start border-4 border-${color} h-100`}>
        <div className="card-body">
          <div className="text-muted small">{label}</div>
          <div className={`stat-number text-${color}`}>{value}</div>
          {hint && <div className="small text-muted">{hint}</div>}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get("/dashboard/")
      .then((data) => !cancelled && setStats(data))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!stats) return <Spinner />;

  const totalAppointments = stats.total_appointments;

  return (
    <>
      <div className="mb-4">
        <h1 className="h3 mb-0">Dashboard</h1>
        <p className="text-muted mb-0">Overview of doctors, patients and appointments</p>
      </div>

      <div className="row g-3 mb-4">
        <StatCard
          label="Doctors"
          value={stats.total_doctors}
          hint={`${stats.available_doctors} available`}
          color="primary"
        />
        <StatCard label="Patients" value={stats.total_patients} color="success" />
        <StatCard label="Appointments" value={totalAppointments} color="info" />
        <StatCard label="Today (scheduled)" value={stats.todays_appointments} color="warning" />
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card mb-3">
            <div className="card-header bg-white fw-semibold">Upcoming appointments</div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>When</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.upcoming_appointments.map((item) => (
                    <tr key={item.id}>
                      <td className="text-nowrap">
                        {formatDate(item.appointment_date)}
                        <div className="small text-muted">{formatTime(item.appointment_time)}</div>
                      </td>
                      <td>{item.patient_name}</td>
                      <td>
                        {item.doctor_name}
                        <div className="small text-muted">{item.doctor_specialization}</div>
                      </td>
                    </tr>
                  ))}
                  {stats.upcoming_appointments.length === 0 && (
                    <tr>
                      <td colSpan="3" className="text-center text-muted py-4">
                        No upcoming appointments.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="card-footer bg-white text-end">
              <Link to="/appointments">View all appointments</Link>
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card mb-3">
            <div className="card-header bg-white fw-semibold">Appointments by status</div>
            <div className="card-body">
              {Object.entries(stats.status_counts).map(([status, count]) => {
                const percent = totalAppointments ? Math.round((count * 100) / totalAppointments) : 0;
                return (
                  <div className="mb-3" key={status}>
                    <div className="d-flex justify-content-between small mb-1">
                      <StatusBadge status={status} />
                      <span className="text-muted">
                        {count} of {totalAppointments} ({percent}%)
                      </span>
                    </div>
                    <div className="progress" role="progressbar" aria-label={STATUS_LABELS[status]} aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100">
                      <div className="progress-bar" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header bg-white fw-semibold">Busiest doctors</div>
            <ul className="list-group list-group-flush">
              {stats.busiest_doctors.map((doctor) => (
                <li className="list-group-item d-flex justify-content-between align-items-center" key={doctor.id}>
                  <div>
                    {doctor.full_name}
                    <div className="small text-muted">{doctor.specialization}</div>
                  </div>
                  <span className="badge text-bg-primary rounded-pill">
                    {doctor.total} total / {doctor.scheduled} upcoming
                  </span>
                </li>
              ))}
              {stats.busiest_doctors.length === 0 && (
                <li className="list-group-item text-muted">No doctors yet.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
