import { useCallback, useState } from 'react';
import { Car, ClipboardCheck, Database, LogOut } from 'lucide-react';
import { VehiclesView } from './components/VehiclesView';
import { UnifiedPortaria } from './components/UnifiedPortaria';
import { Toast } from './components/Toast';
import { useAuth } from './auth/context';
import { Login } from './components/Login';
import { InspectionBell } from './components/InspectionBell';

import{ManagementView,type ManagementSection}from'./components/ManagementView';

type Tab = 'gestao' | 'portaria' | 'veiculos';
const navigation = [
  { key: 'gestao', label: 'Gest\u00e3o', Icon: Database },
  { key: 'portaria', label: 'Pátio', Icon: ClipboardCheck },
  { key: 'veiculos', label: 'Veículos', Icon: Car },
] as const;

function startup() {
  const params = new URLSearchParams(window.location.search);
  const vehicle = params.get('veiculo') || params.get('vehicle') || params.get('codigo') || params.get('code') || '';
  const person = params.get('pessoa') || params.get('person') || params.get('veiculo_pessoal') || params.get('personal_vehicle') || '';
  const requested = params.get('tab')?.toLowerCase();
  const tab: Tab = requested === 'form' || requested === 'registro' ? 'portaria'
    : ['database','banco','dashboard','relatorios','gestao'].includes(requested||'') ? 'gestao'
    : requested === 'vehicles' || requested === 'veiculos' ? 'veiculos' : 'portaria';
  return { vehicle, person, managementSection: (requested==='dashboard'||requested==='relatorios'?'indicadores':'anteriores') as ManagementSection, openDeparture: requested==='form'||requested==='registro', tab: person ? 'portaria' as const : tab };
}

function AuthenticatedApp() {
  const { profile, signOut } = useAuth();
  const [route] = useState(startup);
  const [tab, setTab] = useState<Tab>(route.tab);
  const [departureIntent,setDepartureIntent]=useState(route.openDeparture);
  const [refresh, setRefresh] = useState(0);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const success = useCallback((message: string) => { setToast({ message, type: 'success' }); setRefresh(value => value + 1); }, []);
  const error = useCallback((message: string) => setToast({ message, type: 'error' }), []);
  const navigate = (next: Tab) => { if(next==='portaria')setDepartureIntent(false);setTab(next); window.scrollTo({ top: 0, behavior: 'instant' }); };
  return <div className="min-h-screen gradient-mesh pb-28">
    <div aria-hidden="true" className="pointer-events-none">
      {[1, 2, 3, 4, 5, 6].map(n => <div key={n} className={`decoration-sphere decoration-sphere-${n}`} />)}
      {[1, 2, 3].map(n => <div key={n} className={`decoration-accent decoration-accent-${n}`} />)}
    </div>
    <header className="glass sticky top-0 z-40 border-b border-white/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex items-center justify-between gap-3 py-4">
        <div className="flex min-w-0 items-center gap-3 animate-slide-in"><img src="/gontijofundacoes_logo.jpg" alt="Logo Gontijo" className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14" />
          <div className="min-w-0"><h1 className="text-lg font-bold text-gray-900 sm:text-xl">Controle de Veículos</h1><p className="text-xs text-gray-500">Gestão inteligente de frotas · Sistema Portaria</p><p className="mt-1 truncate text-xs font-medium text-red-700">{profile!.display_name} · {profile!.role === 'admin' ? 'Administrador' : 'Portaria'}</p></div>
        </div><InspectionBell />
      </div></div>
    </header>
    <main id="conteudo-principal" className="relative mx-auto mb-6 max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      {(tab === 'portaria') && <div className="animate-fade-in"><UnifiedPortaria key={String(departureIntent)} startWithForm={departureIntent} initialVehicleLookup={route.vehicle} initialAccessLookup={route.person} onSuccess={success} onError={error} /></div>}
      {tab==='gestao'&&<ManagementView initialSection={route.managementSection} onSuccess={success} onError={error} refresh={refresh} onNew={()=>{setDepartureIntent(true);setTab('portaria');}}/>}
      {tab === 'veiculos' && <div className="animate-fade-in"><VehiclesView userRole={profile!.role} onSuccess={success} onError={error} /></div>}
    </main>
    {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    <nav aria-label="Navegação principal" className="glass fixed inset-x-0 bottom-0 z-50 border-t border-white/20 safe-area-inset-bottom"><div className="mx-auto grid max-w-2xl grid-cols-4 gap-1 px-2 py-3 sm:px-4">
      {navigation.map(({ key, label, Icon }) => <button key={key} onClick={() => navigate(key)} aria-current={tab === key ? 'page' : undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium transition-all sm:px-3 sm:text-xs ${tab === key ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}><Icon className={`h-6 w-6 ${tab === key ? 'stroke-[2.5]' : 'stroke-2'}`} /><span>{label}</span></button>)}
      <button onClick={() => setLogoutOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[10px] font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 sm:text-xs"><LogOut className="h-6 w-6" />Sair</button>
    </div></nav>
    {logoutOpen && <div role="dialog" aria-modal="true" aria-label="Sair do sistema" className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4"><div className="section-card w-full max-w-sm space-y-5"><h2 className="text-xl font-bold">Sair do sistema?</h2><p className="text-sm text-gray-600">Confirme que concluiu os formulários em andamento.</p><div className="flex gap-3"><button className="action-secondary flex-1" onClick={() => setLogoutOpen(false)}>Continuar no sistema</button><button className="action-primary flex-1" onClick={() => void signOut()}>Confirmar saída da conta</button></div></div></div>}
  </div>;
}

export default function App() {
  const { status, message, signOut, refreshAccess } = useAuth();
  if (status === 'loading') return <main className="grid min-h-screen place-items-center"><p role="status">Validando acesso…</p></main>;
  if (status === 'anonymous') return <Login />;
  if (status === 'denied') return <main className="grid min-h-screen place-items-center p-5"><section className="section-card max-w-lg"><h1 className="text-xl font-bold">Acesso bloqueado</h1><p role="alert" className="my-4">{message}</p><div className="flex gap-3"><button onClick={() => void refreshAccess()} className="action-primary">Verificar novamente</button><button onClick={() => void signOut()} className="action-secondary">Sair</button></div></section></main>;
  return <AuthenticatedApp />;
}
