/**
 * Public site configuration.
 *
 * RAZORPAY_PAYMENT_BUTTON_ID — the "Buy me a coffee ☕ ₹199" button on /about.
 * Create it in the Razorpay Dashboard → Payment Button → amount ₹199 → copy
 * the id (looks like "pl_XXXXXXXXXXXXXX") and paste it here. Razorpay hosts
 * the whole checkout, so no backend is needed and the app stays static.
 * Alternatively set RAZORPAY_PAYMENT_LINK to a Payment Link URL as fallback.
 */
export const RAZORPAY_PAYMENT_BUTTON_ID = process.env.NEXT_PUBLIC_RAZORPAY_PB_ID ?? '';
export const RAZORPAY_PAYMENT_LINK = process.env.NEXT_PUBLIC_RAZORPAY_LINK ?? '';

export const REPO_URL = 'https://github.com/prabhassaas/dastavej';
export const COFFEE_AMOUNT = '₹199';
