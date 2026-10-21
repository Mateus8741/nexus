import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Rotas sem sessão: entrada, cadastro de pessoas externas e a LP interna. */
const PUBLIC_PATHS = ["/login", "/setup", "/cadastro", "/conta-criada", "/welcome"];

/** Aberta a visitantes (sem sessão renderiza sem o shell do painel). */
const SEMI_PUBLIC_PATHS = ["/downloads"];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Modo demonstração (?demo=1 liga, ?demo=0 desliga) — ver lib/demo/mode.ts.
  const demoParam = searchParams.get("demo");
  if (demoParam === "1" || demoParam === "0") {
    const url = request.nextUrl.clone();
    url.searchParams.delete("demo");
    const redirect = NextResponse.redirect(url);
    if (demoParam === "1") {
      redirect.cookies.set("nexus-demo", "1", { path: "/", maxAge: 60 * 60 * 24 * 7 });
    } else {
      redirect.cookies.delete("nexus-demo");
    }
    return redirect;
  }

  if (request.cookies.get("nexus-demo")?.value === "1" && !pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // Instaladores estáticos: nunca passam pela checagem de sessão.
  if (pathname.startsWith("/downloads/files")) return NextResponse.next();

  if (
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const coreUrl = process.env.NEXUS_PLUGIN_HOST_URL ?? "http://localhost:4700";

  try {
    const setupRes = await fetch(`${coreUrl}/setup/status`, { cache: "no-store" });
    if (setupRes.ok) {
      const setup = (await setupRes.json()) as { needsSetup: boolean };
      if (setup.needsSetup && !pathname.startsWith("/setup")) {
        return NextResponse.redirect(new URL("/setup", request.url));
      }
    }
  } catch {
    // Core offline — deixa passar para a página mostrar erro
  }

  const semiPublic = SEMI_PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  // Sinaliza ao layout raiz que a página deve renderizar "nua" (sem sidebar/topbar).
  const bareHeaders = new Headers(request.headers);
  bareHeaders.set("x-nexus-bare", "1");

  try {
    const meRes = await fetch(`${coreUrl}/me`, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (meRes.status === 401) {
      // Visitante em "/": mostra a LP (mesma URL). Em /downloads: página aberta, sem shell.
      if (pathname === "/") {
        return NextResponse.rewrite(new URL("/welcome", request.url), {
          request: { headers: bareHeaders },
        });
      }
      if (semiPublic) return NextResponse.next({ request: { headers: bareHeaders } });
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  } catch {
    // Core offline: em páginas abertas, trata como visitante.
    if (semiPublic) return NextResponse.next({ request: { headers: bareHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.png$).*)"],
};
