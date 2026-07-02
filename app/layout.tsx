import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dastavej — Free Client-Side PDF Editor',
  description:
    'Edit, organize, merge, compress and OCR PDFs entirely in your browser. No uploads, no servers, no cost — your files never leave your device.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
