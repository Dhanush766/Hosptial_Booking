import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.jsx";
import Spinner from "./Spinner.jsx";

// Wraps pages that need a logged-in user. Anonymous visitors are sent to /login.
// (The real protection is on the server: the API rejects requests without a valid token.)
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
