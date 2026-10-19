import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(() => {});

// Usage: const notify = useToast();  notify("Saved!");  notify("Failed", "danger");
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message, variant = "success") => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((current) => [...current, { id, message, variant }]);
      setTimeout(() => remove(id), variant === "danger" ? 8000 : 4000);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-container position-fixed top-0 end-0 p-3" style={{ zIndex: 2000 }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast show align-items-center text-bg-${toast.variant} border-0 mb-2`}
            role="alert"
          >
            <div className="d-flex">
              <div className="toast-body">{toast.message}</div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                aria-label="Close"
                onClick={() => remove(toast.id)}
              />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
