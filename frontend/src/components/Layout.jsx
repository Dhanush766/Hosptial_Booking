import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.jsx";

const LINKS = [
  { to: "/", label: "Dashboard", icon: "bi-speedometer2", end: true },
  { to: "/appointments", label: "Appointments", icon: "bi-calendar-check" },
  { to: "/doctors", label: "Doctors", icon: "bi-heart-pulse" },
  { to: "/patients", label: "Patients", icon: "bi-people" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="d-flex flex-column min-vh-100">
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm">
        <div className="container">
          <NavLink className="navbar-brand fw-semibold" to="/">
            <i className="bi bi-hospital me-2" />
            Hospital Appointment Booking System
          </NavLink>
          <button
            className="navbar-toggler"
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="navbar-toggler-icon" />
          </button>
          <div className={`collapse navbar-collapse ${open ? "show" : ""}`}>
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              {LINKS.map((link) => (
                <li className="nav-item" key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                    onClick={() => setOpen(false)}
                  >
                    <i className={`bi ${link.icon} me-1`} />
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="d-flex align-items-center gap-2 text-white">
              <span className="small">
                <i className="bi bi-person-circle me-1" />
                {user.username}
                {user.is_staff && <span className="badge text-bg-light ms-2">Admin</span>}
              </span>
              <button type="button" className="btn btn-outline-light btn-sm" onClick={logout}>
                <i className="bi bi-box-arrow-right me-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="container py-4 flex-grow-1">
        <Outlet />
      </main>

      <footer className="bg-white border-top py-3 text-center text-muted small">
        Hospital Appointment Booking System &middot; Django REST Framework, React, MySQL
      </footer>
    </div>
  );
}
