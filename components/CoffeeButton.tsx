'use client';

import { useEffect, useRef } from 'react';
import {
  COFFEE_AMOUNT,
  RAZORPAY_PAYMENT_BUTTON_ID,
  RAZORPAY_PAYMENT_LINK,
} from '@/lib/config';
import { IconCoffee } from './Icons';

/**
 * "Buy me a coffee" via Razorpay. Uses Razorpay's hosted Payment Button —
 * their script renders the checkout, so the app needs no payment backend.
 * Falls back to a Payment Link, and to a setup hint when neither is set.
 */
export default function CoffeeButton() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!RAZORPAY_PAYMENT_BUTTON_ID || !hostRef.current) return;
    const host = hostRef.current;
    const form = document.createElement('form');
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/payment_button.js';
    script.async = true;
    script.dataset.payment_button_id = RAZORPAY_PAYMENT_BUTTON_ID;
    form.appendChild(script);
    host.appendChild(form);
    return () => {
      host.innerHTML = '';
    };
  }, []);

  if (RAZORPAY_PAYMENT_BUTTON_ID) return <div ref={hostRef} />;

  if (RAZORPAY_PAYMENT_LINK) {
    return (
      <a
        href={RAZORPAY_PAYMENT_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/30 transition hover:bg-amber-400"
      >
        <IconCoffee className="h-5 w-5" />
        Buy me a coffee — {COFFEE_AMOUNT}
      </a>
    );
  }

  return (
    <div className="space-y-2">
      <button
        disabled
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-amber-500/60 px-6 py-3 text-sm font-semibold text-white"
        title="Razorpay is not configured yet"
      >
        <IconCoffee className="h-5 w-5" />
        Buy me a coffee — {COFFEE_AMOUNT}
      </button>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Owner setup: create a ₹199 <b>Payment Button</b> in the Razorpay dashboard and set{' '}
        <code>NEXT_PUBLIC_RAZORPAY_PB_ID</code> (or a Payment Link via{' '}
        <code>NEXT_PUBLIC_RAZORPAY_LINK</code>) at build time.
      </p>
    </div>
  );
}
