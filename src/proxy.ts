import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/shared/lib/auth';

const PUBLIC_PATHS = new Set([
  '/',
  '/sign-in',
  '/sign-up',
  '/reset-password',
  '/verify-email',
  '/invite',
]);

const PUBLIC_PREFIXES = [
  '/eq/',
  '/api/auth/',
  '/api/webhooks/',
  '/sign-in/',
  '/sign-up/',
  '/reset-password/',
  '/verify-email/',
  '/invite/',
];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: req.headers });

  if (!session) {
    const url = new URL('/sign-in', req.url);
    if (path !== '/sign-in') url.searchParams.set('redirect', path);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
