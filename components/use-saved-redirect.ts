"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

// After a successful save: confirm with a toast and go to the feature's list page.
// Call it inside the form's action/transition so the submit button stays pending until the list has loaded.
export function useSavedRedirect(listPath: string) {
  const router = useRouter();
  return (message = "Saved.") => {
    toast.success(message);
    router.push(listPath);
  };
}
