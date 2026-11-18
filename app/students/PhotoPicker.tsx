"use client";

import { Camera, ImageUp } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// Shown when a student has no photo.
function GenericAvatar() {
  return (
    <svg viewBox="0 0 128 128" aria-hidden="true" className="size-full text-muted-foreground">
      <rect width="128" height="128" fill="currentColor" opacity="0.1" />
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
    <div className="flex flex-col gap-3">
      <label htmlFor="photo" className="text-sm font-medium leading-none">
        Photo <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <div className="flex flex-wrap items-center gap-5">
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label="Choose a photo"
          className="group relative size-28 shrink-0 rounded-full bg-muted p-1 ring-2 ring-border outline-none transition-shadow hover:ring-primary focus-visible:ring-3 focus-visible:ring-ring"
        >
          <span className="block size-full overflow-hidden rounded-full">
            {src ? (
              <Image src={src} alt="Student photo preview" width={112} height={112} unoptimized className="size-full object-cover" />
            ) : (
              <GenericAvatar />
            )}
          </span>
          <span
            className="absolute right-0.5 bottom-0.5 grid size-8 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <Camera className="size-4" />
          </span>
        </button>
        <div className="flex flex-col items-start gap-2">
          <Button type="button" variant="outline" onClick={() => input.current?.click()}>
            <ImageUp aria-hidden="true" />
            {src ? "Change photo" : "Choose photo"}
          </Button>
          {existingUrl && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="removePhoto"
                className="size-4 accent-destructive"
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
          <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 2 MB.</p>
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
