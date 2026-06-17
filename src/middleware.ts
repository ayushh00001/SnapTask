import { NextResponse, type NextRequest } from 'next/server'

const protectedPaths = ['/dashboard', '/projects', '/billing', '/settings', '/admin']
const authPages = ['/login', '/signup']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))
  const isAuthPage = authPages.includes(pathname)

  const hasSession = request.cookies.getAll().some(c => c.name.startsWith('sb-'))

  if (!hasSession && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  if (hasSession && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: ['/dashboard/:path*', '/projects/:path*', '/billing/:path*', '/settings/:path*', '/admin/:path*', '/login', '/signup'],
}
