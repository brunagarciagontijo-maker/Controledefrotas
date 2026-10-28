import { useEffect, useState } from 'react';
import { operationalService } from '../services/operationalService';
import { Modal } from './Modal';

type Photos = Awaited<ReturnType<typeof operationalService.listPhotos>>;

export function PrivatePhotos({ movementId }: { movementId: string }) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<Photos>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const ownedUrls:string[]=[];
    setLoading(true); setError(''); setPhotos([]);
    operationalService.listPhotos(movementId)
      .then(data => {const urls=data.map(photo=>photo.file_url).filter(url=>url.startsWith('blob:'));if(active){ownedUrls.push(...urls);setPhotos(data);}else urls.forEach(url=>URL.revokeObjectURL(url));})
      .catch(() => { if (active) setError('Nao foi possivel abrir as fotos. Confira seu acesso e tente atualizar.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false;ownedUrls.forEach(url=>URL.revokeObjectURL(url)); };
  }, [open, movementId, refresh]);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold">Ver fotos</button>
    <Modal isOpen={open} onClose={() => setOpen(false)} title="Fotos da movimentacao">
      <button type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading} className="mb-4 rounded-xl border px-3 py-2 text-sm">Atualizar fotos</button>
      {loading && <p role="status">Carregando fotos...</p>}
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      {!loading && !error && photos.length === 0 && <p>Nenhuma foto anexada.</p>}
      <div className="grid gap-4 sm:grid-cols-2">{photos.map(photo => <figure key={photo.id}>
        <a href={photo.file_url} target="_blank" rel="noopener noreferrer">
          <img src={photo.file_url} referrerPolicy="no-referrer" alt={photo.caption || 'Foto da movimentacao'} className="max-h-80 w-full rounded-xl object-contain" onError={() => setError('Uma foto nao carregou. Atualize as fotos para tentar novamente.')} />
        </a>
        <figcaption className="mt-2 text-sm text-gray-600">{photo.phase} · {photo.caption}</figcaption>
      </figure>)}</div>
    </Modal>
  </>;
}
