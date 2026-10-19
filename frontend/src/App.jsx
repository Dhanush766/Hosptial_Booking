import { Route, Routes } from "react-router-dom";

import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Appointments from "./pages/Appointments.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Doctors from "./pages/Doctors.jsx";
import Login from "./pages/Login.jsx";
import NotFound from "./pages/NotFound.jsx";
import Patients from "./pages/Patients.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="doctors" element={<Doctors />} />
        <Route path="patients" element={<Patients />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
