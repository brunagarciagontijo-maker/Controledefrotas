import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LogIn, Lock } from 'lucide-react';
import { useAuth } from '../auth/context';
import { requireDevEnvironment } from '../lib/runtime';
export type { UserRole } from '../auth/authorization';

export function Login() {
  const original=requireDevEnvironment().mode==='original';
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await signIn(email, password); setPassword(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Nao foi possivel entrar.'); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen gradient-mesh flex items-center justify-center p-4">
    <section className="glass w-full max-w-md rounded-3xl p-7 shadow-premium-lg animate-scale-in sm:p-10">
      <p className="mb-3 text-xs font-bold text-red-700">{original?'ORIGINAL · DADOS EXISTENTES':'DEV · SOMENTE DADOS FICTÍCIOS'}</p>
      <img src="/gontijofundacoes_logo.jpg" alt="Gontijo" className="mx-auto mb-4 h-20 w-20 object-contain" />
      <h1 className="text-2xl font-bold text-gray-900">Sistema Portaria</h1>
      <p className="mt-2 mb-6 text-sm text-gray-600">Entre com sua conta autorizada do projeto conferido.</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium text-gray-800">Email
          <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-gray-200 p-3" />
        </label>
        <label className="block text-sm font-medium text-gray-800">Senha
          <span className="relative mt-1 block"><input type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border-2 border-gray-200 p-3 pr-12" />
            <button type="button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(!visible)} className="absolute right-3 top-3">{visible ? <EyeOff /> : <Eye />}</button>
          </span>
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 p-3 font-bold text-white disabled:opacity-50"><LogIn className="h-5 w-5" />{busy ? 'Entrando...' : 'Entrar'}</button>
      </form>
      <p className="mt-5 flex items-center gap-2 text-xs text-gray-500"><Lock className="h-4 w-4" />Acesso e perfil verificados pelo Supabase Auth.</p>
    </section>
  </main>;
}
