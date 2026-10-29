import { reportError } from '../utils/diagnostics';
import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt?: () => Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (import.meta.env.MODE === 'devcloud') return;
    // Verificar se a app já está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      console.log('✅ App está instalado como PWA');
    }

    // Ouvir evento install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as InstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setShowPrompt(true);
      console.log('📦 Prompt de instalação disponível');
    };

    // Verificar se foi instalado
    const handleAppInstalled = () => {
      console.log('✅ App foi instalado como PWA');
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt?.();
      const result = await deferredPrompt.userChoice;
      
      if (result?.outcome === 'accepted') {
        console.log('✅ Usuário aceitou instalar a app');
        setShowPrompt(false);
      } else {
        console.log('❌ Usuário rejeitou a instalação');
      }
    } catch (error) {
      reportError('❌ Erro ao instalar:', error);
    }
  };

  if (import.meta.env.MODE === 'devcloud' || isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 animate-slide-up">
      <div className="glass card-shine rounded-2xl shadow-premium-lg border-2 border-white/20 overflow-hidden">
        {/* Barra superior colorida */}
        <div className="h-1.5 bg-gradient-to-r from-red-500 via-orange-500 to-red-600"></div>
        
        <div className="p-6">
          <div className="flex gap-4 items-start mb-4">
            {/* Ícone animado */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl blur-lg opacity-50 animate-pulse"></div>
              <div className="relative w-14 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Download className="w-7 h-7 text-white animate-bounce" />
              </div>
            </div>
            
            {/* Conteúdo */}
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                Instalar App
              </h3>
              <p className="text-sm text-gray-700 font-medium leading-relaxed">
                Instale o Sistema de Frotas para acesso rápido e offline!
              </p>
            </div>

            {/* Botão fechar */}
            <button
              onClick={() => setShowPrompt(false)}
              className="p-2 rounded-lg hover:bg-white/50 text-gray-600 hover:text-gray-900 transition-all duration-200 hover:scale-110"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Botões de ação */}
          <div className="flex gap-3">
            <button
              onClick={handleInstall}
              className="group relative flex-1 px-5 py-3.5 gradient-primary text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              <span>Instalar Agora</span>
            </button>
            <button
              onClick={() => setShowPrompt(false)}
              className="px-5 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200"
            >
              Depois
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
