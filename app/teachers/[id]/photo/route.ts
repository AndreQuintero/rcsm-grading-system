import { servePhoto } from "@/lib/photo-response";

export const GET = (_req: Request, { params }: { params: Promise<{ id: string }> }) => servePhoto("teachers", params);
