'use client';

import type { ReactNode } from 'react';

interface SessionProviderProps {
  children: ReactNode;
}

/**
 * Pass-through. Better Auth no requiere provider — las cookies se manejan en server.
 * Mantenemos el componente para no romper el árbol del layout.
 */
export function SessionProvider({ children }: SessionProviderProps) {
  return <>{children}</>;
}
