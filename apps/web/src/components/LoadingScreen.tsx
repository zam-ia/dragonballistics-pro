interface LoadingScreenProps {
  label: string;
  compact?: boolean;
}

export function LoadingScreen({ label, compact = false }: LoadingScreenProps) {
  return (
    <div className={compact ? 'loading-screen compact' : 'loading-screen'} role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
