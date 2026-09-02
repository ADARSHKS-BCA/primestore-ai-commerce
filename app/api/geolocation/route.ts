import { NextResponse } from 'next/server';

/**
 * GET /api/geolocation
 *
 * Resolves client IP to a city/state address string using ip-api.com.
 * Used for first-order delivery address pre-fill.
 * The resolved address is presented verbally for confirmation — never used silently.
 */
export async function GET(request: Request) {
  try {
    // Extract client IP from headers (works behind proxies/Vercel)
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const clientIp = forwardedFor?.split(',')[0]?.trim() || realIp || null;

    console.log(`[Geolocation] Resolving address for IP: ${clientIp || 'unknown'}`);

    // Use ip-api.com free tier (no API key required, 45 req/min)
    const apiUrl = clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1'
      ? `http://ip-api.com/json/${clientIp}?fields=status,city,regionName,country,zip`
      : `http://ip-api.com/json/?fields=status,city,regionName,country,zip`;

    const geoRes = await fetch(apiUrl, { signal: AbortSignal.timeout(3000) });

    if (!geoRes.ok) {
      throw new Error(`ip-api.com returned ${geoRes.status}`);
    }

    const geoData = await geoRes.json();

    if (geoData.status !== 'success') {
      return NextResponse.json({
        address: null,
        message: 'Could not determine your location. Please provide your delivery address.',
      });
    }

    const parts = [geoData.city, geoData.regionName, geoData.country].filter(Boolean);
    const address = parts.join(', ') + (geoData.zip ? ` - ${geoData.zip}` : '');

    console.log(`[Geolocation] Resolved: ${address}`);

    return NextResponse.json({
      address,
      city: geoData.city,
      region: geoData.regionName,
      country: geoData.country,
      zip: geoData.zip,
    });
  } catch (error) {
    console.warn('[Geolocation] Error:', error);
    return NextResponse.json({
      address: null,
      message: 'Location lookup failed. Please provide your delivery address manually.',
    });
  }
}
