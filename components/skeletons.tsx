import { FormCard } from "@/components/form-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Loading placeholders that mirror the real pages: real labels and column headers, pulsing blocks where data goes.
// The visual part is aria-hidden; screen readers get a single "Loading" status instead.
const Status = () => (
  <span role="status" className="sr-only">
    Loading
  </span>
);

const label = "text-sm font-medium leading-none";

function Field({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className={label}>{name}</span>
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

// Title, description and the back arrow of a register/edit page.
export function HeaderSkeleton() {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56 sm:h-10" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="size-9 rounded-full" />
    </div>
  );
}

const WIDTHS = ["w-36", "w-24", "w-44", "w-28", "w-32"];

// Filter card, result count, table and pager of a list page. The last column is the row actions.
export function ListSkeleton({ filters, columns, rows = 6 }: { filters: string[]; columns: string[]; rows?: number }) {
  return (
    <>
      <Status />
      <div aria-hidden="true">
        <Card className="mb-6">
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              {filters.map((f) => (
                <div key={f} className="min-w-48 flex-1">
                  <Field name={f} />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-20" />
            </div>
          </CardContent>
        </Card>

        <Skeleton className="mb-3 h-4 w-28" />
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c, i) => (
                  <TableHead
                    key={c}
                    className={i === 0 ? "pl-4" : i === columns.length - 1 ? "w-24 pr-4 text-right" : undefined}
                  >
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rows }, (_, r) => (
                <TableRow key={r}>
                  {columns.map((c, i) => (
                    <TableCell key={c} className={i === 0 ? "pl-4" : i === columns.length - 1 ? "pr-4" : undefined}>
                      {i === columns.length - 1 ? (
                        <div className="flex justify-end gap-1">
                          <Skeleton className="size-8" />
                          <Skeleton className="size-8" />
                        </div>
                      ) : (
                        <Skeleton className={`h-4 ${WIDTHS[(r + i) % WIDTHS.length]}`} />
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </div>
    </>
  );
}

// The form card of a register/edit page. Options add the photo picker, a row of radio pills (status, semester)
// and a grid of selectable cards (the batch's students).
export function FormSkeleton({
  fields,
  photo,
  radios,
  cards,
}: {
  fields: string[];
  photo?: boolean;
  radios?: { name: string; count: number };
  cards?: string;
}) {
  return (
    <>
      <Status />
      <div aria-hidden="true">
        <FormCard footer={<Skeleton className="h-10 w-40" />}>
          {photo && (
            <div className="flex items-center gap-4">
              <Skeleton className="size-20 rounded-full" />
              <Skeleton className="h-9 w-32" />
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            {fields.map((f, i) => (
              <div key={f} className={i === 0 ? "sm:col-span-2" : undefined}>
                <Field name={f} />
              </div>
            ))}
          </div>
          {radios && (
            <div className="flex flex-col gap-3">
              <span className={label}>{radios.name}</span>
              <div className="flex flex-wrap gap-3">
                {Array.from({ length: radios.count }, (_, i) => (
                  <Skeleton key={i} className="h-10 w-28 rounded-lg" />
                ))}
              </div>
            </div>
          )}
          {cards && (
            <div className="flex flex-col gap-3">
              <span className={label}>{cards}</span>
              <Skeleton className="h-9 w-full" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            </div>
          )}
        </FormCard>
      </div>
    </>
  );
}
