'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import { FilterProvider } from '../contexts/FilterContext';
import LayoutWrapper from './LayoutWrapper';

export default function ClientProviders({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthProvider>
      <FilterProvider>
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </FilterProvider>
    </AuthProvider>
  );
}
