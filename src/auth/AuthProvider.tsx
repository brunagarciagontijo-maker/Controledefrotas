import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getSupabase } from '../lib/supabase';
import { requireDevEnvironment } from '../lib/runtime';
import { AuthContext, type AuthState } from './context';
import { parseProfile, type AppProfile } from './authorization';
import { ORIGINAL_SCHEMA_VERSION, originalReleaseMatches } from '../config/originalRelease';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [message, setMessage] = useState('');
  const revision = useRef(0);
  const loggedOut = useRef(false);
  const invalidate = useCallback(() => { ++revision.current; }, []);

  const refreshAccess = useCallback(async () => {
    if (loggedOut.current) { setProfile(null); setStatus('anonymous'); return; }
    const current = ++revision.current;
    try {
      const client = getSupabase();
      const expected = requireDevEnvironment();
      const original=expected.mode==='original';
      const { data: marker, error: markerError } = await client.rpc(original?'portaria_get_environment':'get_dev_environment');
      if (markerError || !marker || typeof marker !== 'object' || Array.isArray(marker) || marker.project_ref !== expected.projectRef || marker.environment !== (original?'original':'devcloud') || marker.schema_version !== (original?ORIGINAL_SCHEMA_VERSION:1)) throw new Error('Contrato do banco nao reconhecido.');
      if(original&&!originalReleaseMatches(marker,expected.release))throw new Error('Revisao do banco nao corresponde a liberacao local.');
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (current !== revision.current) return;
      if (sessionError) throw sessionError;
      if (!sessionData.session) {
        setProfile(null); setStatus('anonymous'); setMessage(''); return;
      }
      // O servidor verifica o JWT e resolve o perfil de auth.uid(), sem parametros.
      const { data, error } = await client.rpc(original?'portaria_get_profile':'get_my_profile');
      if (current !== revision.current) return;
      if (error) throw error;
      const approved = parseProfile(data);
      if (!approved || !approved.is_active || approved.user_id !== sessionData.session.user.id) {
        setProfile(null); setStatus('denied');
        setMessage('Conta sem perfil autorizado ou inativa. Solicite a habilitacao no projeto autorizado.'); return;
      }
      setProfile(approved); setStatus('authorized'); setMessage('');
    } catch {
      if (current !== revision.current) return;
      setProfile(null); setStatus('denied');
      setMessage('Nao foi possivel validar seu acesso. Confira a conexao e a preparacao do banco autorizado.');
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    void refreshAccess();
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { loggedOut.current = true; invalidate(); setProfile(null); setStatus('anonymous'); return; }
      if (event === 'SIGNED_IN') { loggedOut.current = false; setProfile(null); setStatus('loading'); }
      // Nao aguarda chamadas Auth dentro do callback do SDK.
      queueMicrotask(() => { if (!disposed) void refreshAccess(); });
    });
    const recheck = () => { if (!disposed) void refreshAccess(); };
    const interval = window.setInterval(recheck, 60000);
    window.addEventListener('focus', recheck);
    return () => { disposed = true; invalidate(); data.subscription.unsubscribe(); window.clearInterval(interval); window.removeEventListener('focus', recheck); };
  }, [refreshAccess, invalidate]);

  const signIn = async (email: string, password: string) => {
    loggedOut.current = false;
    setProfile(null); setMessage('');
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error('Nao foi possivel entrar. Confira email, senha e acesso ao projeto autorizado.');
    await getSupabase().auth.startAutoRefresh();
    await refreshAccess();
  };
  const signOut = async () => {
    loggedOut.current = true; invalidate();
    setProfile(null); setStatus('anonymous'); setMessage('');
    try { await getSupabase().auth.signOut({ scope: 'local' }); }
    catch { /* Falha de rede nao mantem a tela autorizada. */ }
    finally {
      try { await getSupabase().auth.stopAutoRefresh(); }
      catch { /* A interface ja foi bloqueada, mesmo se o SDK falhar. */ }
      const key = `portaria-dev-${requireDevEnvironment().projectRef}`;
      try { localStorage.removeItem(key); localStorage.removeItem(`${key}-code-verifier`); }
      catch { /* Navegadores podem impedir acesso ao armazenamento local. */ }
    }
  };
  return <AuthContext.Provider value={{ status, profile, message, signIn, signOut, refreshAccess }}>{children}</AuthContext.Provider>;
}
