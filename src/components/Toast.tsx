interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50">
      <div className="rounded-lg border border-emerald-500/30 bg-[#0d141f]/95 px-4 py-2 text-sm text-emerald-200 shadow-[0_12px_35px_rgba(0,0,0,0.45)]">
        {message}
      </div>
    </div>
  );
}
