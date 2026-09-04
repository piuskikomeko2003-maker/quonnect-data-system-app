import { type NextRequest } from 'next/server';

const DEV_ORIGIN = 'http://localhost:3000';

export function getAppOrigin(request?: NextRequest): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;

  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (process.env.NODE_ENV === 'development') {
    return DEV_ORIGIN;
  }

  const forwardedHost = request?.headers.get('x-forwarded-host');
  const forwardedProto = request?.headers.get('x-forwarded-proto');

  if (forwardedHost) {
    return `${forwardedProto || 'https'}://${forwardedHost}`;
  }

  return request?.nextUrl.origin || DEV_ORIGIN;
}
