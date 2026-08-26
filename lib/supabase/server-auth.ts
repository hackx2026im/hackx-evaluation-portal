import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Allow auth callback, reset password, and API proxy routes to pass through.
  // API proxy routes (e.g. /api/proxy/pdf) handle their own authentication
  // and must not be redirected to /login, which would return HTML instead of binary data.
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/api/proxy") || pathname === "/reset-password") {
    return supabaseResponse;
  }

  // Onboarding preview: renders the guide in isolation with no database access.
  // Non-production only, so it can never be reached on a deployed build.
  if (pathname === "/onboard-preview" && process.env.NODE_ENV !== "production") {
    return supabaseResponse;
  }

  // Not logged in → redirect to login (except if already on login page)
  if (!user && pathname !== "/login" && pathname !== "/reset-password") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let profile: { role: string } | null = null;
  if (user && (pathname === "/login" || pathname === "/" || pathname.startsWith("/admin"))) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  // Logged in and on login page or root → redirect to appropriate dashboard
  if (user && (pathname === "/login" || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = profile?.role === "admin" ? "/admin" : "/evaluator";
    return NextResponse.redirect(url);
  }

  // RBAC: evaluator trying to access admin routes
  if (user && pathname.startsWith("/admin")) {
    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/evaluator";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
