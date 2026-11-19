// Silhouette shown when there is no photo.
export function GenericAvatar({ className = "text-muted-foreground" }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" aria-hidden="true" className={`size-full ${className}`}>
      <rect width="128" height="128" fill="currentColor" opacity="0.1" />
      <circle cx="64" cy="50" r="22" fill="currentColor" opacity="0.35" />
      <path d="M22 124c0-24 19-42 42-42s42 18 42 42z" fill="currentColor" opacity="0.35" />
    </svg>
  );
}
