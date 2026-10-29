import { createContext, useContext } from 'react';
import type { AppProfile } from './authorization';

export interface AuthState {
  status: 'loading' | 'anonymous' | 'authorized' | 'denied';
  profile: AppProfile | null;
  message: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccess: () => Promise<void>;
}
export const AuthContext = createContext<AuthState | null>(null);
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('Autenticacao nao inicializada.');
  return context;
}
