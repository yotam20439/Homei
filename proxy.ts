import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEVICE_COOKIE, readDevice } from "@/lib/device";

const PUBLIC_PATHS = ["/login", "/signup", "/reset", "/api/cron", "/privacy"];
const VERIFY_PATH = "/verify";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    }
  );

  // Refreshes the session if needed. Do not put code between client creation and this call.
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  const redirect = (to: string, withNext = true) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    if (withNext && path !== "/") url.searchParams.set("next", path + request.nextUrl.search);
    const r = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  if (!userId) {
    return isPublic ? response : redirect("/login");
  }

  const deviceOk = await readDevice(
    process.env.DEVICE_COOKIE_SECRET ?? "",
    request.cookies.get(DEVICE_COOKIE)?.value,
    userId
  );

  if (!deviceOk && !isPublic && path !== VERIFY_PATH) return redirect(VERIFY_PATH);
  if (deviceOk && (path === "/login" || path === "/signup" || path === VERIFY_PATH)) return redirect("/", false);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|webp|ico)$).*)"],
};
