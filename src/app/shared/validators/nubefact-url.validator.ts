const NUBEFACT_HOST_SUFFIX = 'nubefact.com';

/** Returns true only for HTTPS links served by Nubefact or one of its subdomains. */
export function esUrlPdfNubefactValida(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (host === NUBEFACT_HOST_SUFFIX || host.endsWith(`.${NUBEFACT_HOST_SUFFIX}`));
  } catch {
    return false;
  }
}
