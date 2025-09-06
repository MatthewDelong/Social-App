import { useCallback, useState } from "react";

export function useToasts(defaultDuration = 3000) {
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((message, type = "success", duration) => {
    const id = Math.random().toString(36).slice(2);
    const d = duration ?? defaultDuration;
    setToasts((t) => [...t, { id, message, type }]);
    if (d > 0) {
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, d);
    }
    return id;
  }, [defaultDuration]);

  const removeToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  return { toasts, pushToast, removeToast };
}
