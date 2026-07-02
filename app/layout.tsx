import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dastavej — Free Client-Side PDF Editor',
  description:
    'Edit, organize, merge, compress, convert and OCR PDFs entirely in your browser. No uploads, no servers, no cost — your files never leave your device.',
};

// Applies the saved theme before first paint so there is no flash.
const themeInit = `try{var t=localStorage.getItem('dastavej-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="h-full bg-slate-100 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
