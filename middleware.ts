import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Role-based route mappings
const roleRoutes: Record<string, string[]> = {
  super_admin: ['/super-admin', '/aggregator', '/field-operator', '/recycler', '/business', '/government', '/ngo', '/sustainability', '/regulator', '/civil-society', '/policy-maker', '/investor', '/platform-leadership'],
  aggregator: ['/aggregator', '/reports'],
  field_operator: ['/field-operator'],
  recycler: ['/recycler'],
  business: ['/business'],
  government: ['/government'],
  ngo: ['/ngo'],
  sustainability_team: ['/sustainability'],
  regulator: ['/regulator'],
  civil_society: ['/civil-society'],
  policy_maker: ['/policy-maker'],
  investor: ['/investor'],
  platform_leadership: ['/platform-leadership'],
};

// Public routes (no authentication required)
const publicRoutes = ['/login', '/register', '/forgot-password'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Get session token from cookies
  const sessionToken = request.cookies.get('session')?.value;
  
  if (!sessionToken) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  try {
    // Verify session and get user role
    const response = await fetch(`${request.nextUrl.origin}/api/auth/verify`, {
      headers: { 'Cookie': `session=${sessionToken}` }
    });
    
    if (!response.ok) {
      throw new Error('Invalid session');
    }
    
    const { role } = await response.json();
    
    // Check if user has access to this route
    const allowedRoutes = roleRoutes[role as keyof typeof roleRoutes] || [];
    const hasAccess = allowedRoutes.some(route => pathname.startsWith(route));
    
    if (!hasAccess) {
      // Redirect to their default dashboard
      const defaultRoute = getDefaultRouteForRole(role);
      return NextResponse.redirect(new URL(defaultRoute, request.url));
    }
    
    return NextResponse.next();
  } catch (error) {
    // Clear invalid session and redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session');
    return response;
  }
}

function getDefaultRouteForRole(role: string): string {
  const defaults: Record<string, string> = {
    super_admin: '/super-admin',
    aggregator: '/aggregator',
    field_operator: '/field-operator',
    recycler: '/recycler',
    business: '/business',
    government: '/government',
    ngo: '/ngo',
    sustainability_team: '/sustainability',
    regulator: '/regulator',
    civil_society: '/civil-society',
    policy_maker: '/policy-maker',
    investor: '/investor',
    platform_leadership: '/platform-leadership',
  };
  return defaults[role] || '/login';
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};