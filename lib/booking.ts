/** Central public booking destinations. Keep booking URLs in environment config. */
function safeBookingHref(value: string): string {
  const raw = value.trim();
  if (!raw || /[\u0000-\u0020\\]/.test(raw)) return "";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

/** Free 20-minute workflow/product call used across commercial marketing pages. */
export const workflowCallHref =
  safeBookingHref(process.env.NEXT_PUBLIC_HOMEPAGE_BOOKING_URL ?? "") || "/contact";

/** Dedicated Done For You discovery calendar. Never silently route to product demo. */
export const doneForYouCallHref =
  safeBookingHref(process.env.NEXT_PUBLIC_DFU_BOOKING_URL ?? "") || "/contact";
