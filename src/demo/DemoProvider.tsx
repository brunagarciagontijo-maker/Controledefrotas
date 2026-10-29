import { useState, type ReactNode } from 'react';
import { ClipboardCheck, ShieldCheck, Users } from 'lucide-react';
import { AuthContext, type AuthState } from '../auth/context';
import{demoStore}from'../domain/demoStore';
import type { AppProfile, UserRole } from '../auth/authorization';

export function DemoProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const choose=(next:UserRole)=>{demoStore.actorName=`Simula\u00e7\u00e3o ${next}`;setRole(next);};
  const profile: AppProfile | null = role ? { user_id: role === 'admin' ? '90000000-0000-4000-8000-000000000001' : '90000000-0000-4000-8000-000000000002', display_name: `Simulação ${role}`, role, is_active: true } : null;
  const value: AuthState = { status: profile ? 'authorized' : 'anonymous', profile, message: '', signIn: async () => { throw new Error('Demonstração sem login remoto.'); }, signOut: async () => setRole(null), refreshAccess: async () => {} };
  return <AuthContext.Provider value={value}>
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-950 sm:text-sm">SIMULAÇÃO LOCAL · dados fictícios · sem conexão ao Supabase · dados descartados ao recarregar</div>
    {role ? children : <main className="gradient-mesh flex min-h-[calc(100dvh-60px)] items-center justify-center px-4 py-10">
      <div aria-hidden="true" className="decoration-sphere decoration-sphere-1" /><div aria-hidden="true" className="decoration-sphere decoration-sphere-2" />
      <section className="glass relative w-full max-w-lg rounded-3xl p-6 shadow-premium-lg animate-scale-in sm:p-10">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-white shadow-premium"><img src="/gontijofundacoes_logo.jpg" alt="Logo Gontijo" className="h-20 w-20 object-contain" /></div>
        <div className="mb-8 text-center"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-red-600">Gontijo Fundações</p><h1 className="text-3xl font-bold text-gray-900">Controle de Veículos</h1><p className="mt-2 text-sm text-gray-500">Gestão inteligente de frotas · Sistema Portaria</p></div>
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><h2 className="mb-2 flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5" />Revisão local da interface</h2><p>Use somente dados e documentos fictícios. Escolha um perfil para testar; as alterações desaparecem ao recarregar.</p></div>
        <div className="grid gap-3 sm:grid-cols-2"><button className="action-primary flex-col py-5" onClick={() => choose('admin')}><Users className="h-6 w-6" />Simular administrador</button><button className="action-secondary flex-col py-5" onClick={() => choose('porteiro')}><ClipboardCheck className="h-6 w-6 text-red-600" />Simular porteiro</button></div>
      </section>
    </main>}
  </AuthContext.Provider>;
}
