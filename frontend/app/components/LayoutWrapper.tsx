'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Don't show header on login page
  const showHeader = pathname !== '/login';

  return (
    <>
      {showHeader && <Header />}
      {children}
    </>
  );
}
