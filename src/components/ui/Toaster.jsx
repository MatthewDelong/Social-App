export default function Toaster({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={
            `pointer-events-auto flex items-center gap-3 rounded-md border px-4 py-2 shadow-lg ` +
            (t.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : t.type === "info"
              ? "bg-blue-50 border-blue-200 text-blue-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800")
          }
        >
          <span className="text-sm">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="ml-auto text-xs opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
