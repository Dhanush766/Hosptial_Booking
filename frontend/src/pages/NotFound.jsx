import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="text-center py-5">
      <div className="display-1 fw-bold text-primary">404</div>
      <h1 className="h3 mb-3">Page not found</h1>
      <p className="text-muted">The page you are looking for does not exist.</p>
      <Link to="/" className="btn btn-primary">
        Go to Dashboard
      </Link>
    </div>
  );
}
