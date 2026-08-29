import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  // Gerado/sobrescrito aqui, sempre — nunca confia num x-request-id vindo do
  // cliente. .set() substitui qualquer valor pré-existente no header, então
  // mesmo que um cliente mal-intencionado envie o próprio x-request-id, ele
  // nunca chega às Route Handlers.
  const requestId = crypto.randomUUID()
  request.headers.set('x-request-id', requestId)

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
