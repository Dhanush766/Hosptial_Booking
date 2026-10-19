export default function Spinner({ label = "Loading..." }) {
  return (
    <div className="text-center text-muted py-5" role="status">
      <div className="spinner-border text-primary mb-2" aria-hidden="true" />
      <div>{label}</div>
    </div>
  );
}
