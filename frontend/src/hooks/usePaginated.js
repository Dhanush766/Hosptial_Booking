import { useCallback, useEffect, useState } from "react";

import { api } from "../api.js";

// Loads a paginated DRF list and reloads it whenever the path or params change.
//   const { data, loading, error, reload } = usePaginated("/doctors/", { search, page });
// `data` is DRF's { count, next, previous, results } object.
export default function usePaginated(path, params) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [version, setVersion] = useState(0);
  const key = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false; // ignore answers that arrive after a newer request was made
    setState((current) => ({ ...current, loading: true, error: "" }));
    api
      .get(path, params)
      .then((data) => {
        if (!cancelled) setState({ loading: false, error: "", data });
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, error: error.message, data: null });
      });
    return () => {
      cancelled = true;
    };
    // `key` stands for `params`; `version` is bumped by reload().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...state, reload };
}
