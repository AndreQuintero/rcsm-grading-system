import type { ReactNode } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

// Form body in a card with a footer bar for the submit button and its result message.
export function FormCard({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <Card className="max-w-3xl overflow-visible [--card-spacing:--spacing(6)]">
      <CardContent className="flex flex-col gap-6">{children}</CardContent>
      <CardFooter className="flex-wrap gap-x-4 gap-y-2">{footer}</CardFooter>
    </Card>
  );
}
