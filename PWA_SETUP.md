# Fluxo atual: Supabase original

Siga [ORIGINAL_ACCESS.md](ORIGINAL_ACCESS.md) e [ORIGINAL_RELEASE.md](ORIGINAL_RELEASE.md). A estrategia DEV abaixo foi substituida; nao aplicar seus SQLs no original.

# PWA no desenvolvimento

O procedimento atual esta em [DEV_SETUP.md](DEV_SETUP.md).

O perfil devcloud utiliza projeto independente, Auth real, RLS restritiva e Storage privado. Nao execute o SQL avulso nem as migrations historicas no projeto DEV. PWA e service worker ficam desativados neste perfil.
