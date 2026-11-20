"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// Opens the browser's print dialog on the print-ready record (see @media print in globals.css), where "Save as PDF"
// gives the file. The document title becomes the suggested file name while the dialog is open.
export function ExportPdfButton({ fileName }: { fileName: string }) {
  const exportPdf = () => {
    const title = document.title;
    document.title = fileName;
    window.addEventListener("afterprint", () => (document.title = title), { once: true });
    window.print();
  };
  return (
    <Button type="button" variant="outline" size="lg" onClick={exportPdf} className="rounded-full print:hidden">
      <Download aria-hidden="true" />
      Export PDF
    </Button>
  );
}
