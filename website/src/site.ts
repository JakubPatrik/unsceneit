// Site-wide settings. Change these in one place.

// The Chrome Web Store listing (the install buttons and the footer link).
// null shows "Coming soon to Chrome" instead of linking.
export const CHROME_STORE_URL: string | null =
  "https://chromewebstore.google.com/detail/unsceneit/inpekbgpobkhdmfilepnojnfflhocgid"

// The company behind unscene.it (footer, and the data controller in the
// privacy policy).
export const COMPANY = {
  name: "DoubleCross Digital LLC",
  address: "30 N Gould St, Ste R, Sheridan, WY 82801, USA",
}

// Where support and privacy requests go (listed on the site and in the policy).
export const SUPPORT_EMAIL = "hello@unscene.it"

// Last change to the privacy policy (shown at its top).
export const PRIVACY_UPDATED = "October 16, 2026"

// The early access waitlist's promise (waitlist page, pricing card):
// founding members keep this discount for life.
export const FOUNDER_OFFER = "50% off Pro for life"

// Supabase, for the waitlist form. The publishable key is public by design;
// the database only lets it call join_waitlist() (see the waitlist migration).
// Same project as extension/config.js.
export const SUPABASE_URL = "https://sankeqoeuociotbufbsb.supabase.co"
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_JDPQRTbTBP2DS73o0SCRZQ_xy9VsmaY"
