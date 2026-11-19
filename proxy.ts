import { NextResponse, type NextRequest } from "next/server";
import { requiredRole, ROLE_HOME } from "@/lib/auth/roles";
import { lookupSession, SESSION_COOKIE, touchSession } from "@/lib/auth/session";

// Deny by default: every request except the public sign-in pages and static assets needs a valid session
// (checked in the database on each request) holding the role of the area. Server actions and route
// handlers also check for themselves, since an action can be posted to any path.
const PUBLIC = ["/login", "/set-password"];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await lookupSession(req.cookies.get(SESSION_COOKIE)?.value);

  if (PUBLIC.includes(pathname)) {
    if (session && pathname === "/login" && req.method === "GET") return NextResponse.redirect(new URL(ROLE_HOME[session.activeRole], req.url));
    return NextResponse.next();
  }
  if (!session) {
    if (req.method === "GET" || req.method === "HEAD") {
      const login = new URL("/login", req.url);
      if (pathname !== "/") login.searchParams.set("next", pathname + search);
      return NextResponse.redirect(login);
    }
    return new NextResponse("Unauthorized", { status: 401 });
  }
  // "/" is the admin home; other roles are sent to their own home instead of a 403
  if (pathname === "/" && !session.roles.includes("admin")) return NextResponse.redirect(new URL(ROLE_HOME[session.activeRole], req.url));
  if (!session.roles.includes(requiredRole(pathname))) return new NextResponse("Forbidden", { status: 403 });
  if (session.stale) await touchSession(session.id);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo.png).*)"],
};
