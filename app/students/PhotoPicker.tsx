"use client";

import Image from "next/image";
import { useRef, useState } from "react";

// Shown when a student has no photo.
function GenericAvatar() {
  return (
    <svg viewBox="0 0 128 128" aria-hidden="true">
      <rect width="128" height="128" fill="currentColor" opacity="0.08" />
      <circle cx="64" cy="50" r="22" fill="currentColor" opacity="0.35" />
      <path d="M22 124c0-24 19-42 42-42s42 18 42 42z" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

// Preview order: newly chosen file, else the stored photo (unless marked for removal), else the generic avatar.
export function PhotoPicker({ existingUrl }: { existingUrl?: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const blob = useRef<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const src = preview ?? (removed ? null : (existingUrl ?? null));

  const setBlob = (file: File | undefined) => {
    if (blob.current) URL.revokeObjectURL(blob.current);
    blob.current = file ? URL.createObjectURL(file) : null;
    setPreview(blob.current);
  };

  return (
    <div className="field">
      <label htmlFor="photo" className="field-label">
        Photo <span className="optional">(optional)</span>
      </label>
      <div className="photo-picker">
        <button type="button" className="avatar" onClick={() => input.current?.click()} aria-label="Choose a photo">
          {src ? (
            <Image src={src} alt="Student photo preview" width={128} height={128} unoptimized />
          ) : (
            <GenericAvatar />
          )}
          <span className="avatar-badge" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8h4l2-3h6l2 3h4v11H3z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </span>
        </button>
        <div className="photo-actions">
          <button type="button" className="btn btn-ghost" onClick={() => input.current?.click()}>
            {src ? "Change photo" : "Choose photo"}
          </button>
          {existingUrl && (
            <label className="choice-option">
              <input
                type="checkbox"
                name="removePhoto"
                onChange={(e) => {
                  setRemoved(e.target.checked);
                  if (e.target.checked && input.current) {
                    input.current.value = ""; // a pending new file and "remove" would contradict each other
                    setBlob(undefined);
                  }
                }}
              />
              Remove current photo
            </label>
          )}
          <p className="hint">JPEG, PNG or WebP, up to 2 MB.</p>
        </div>
      </div>
      <input
        ref={input}
        id="photo"
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => setBlob(e.target.files?.[0])}
      />
    </div>
  );
}
