import { CircleCheck } from "lucide-react";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function SuccessMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="status" className="flex items-center gap-2 text-sm font-medium text-success">
      <CircleCheck className="size-4" aria-hidden="true" />
      {message}
    </p>
  );
}
