import { useState } from 'react';
import { REQUIRED_PHOTO_ITEMS, type EvidenceFiles, type PhotoItem } from '../domain/portaria';
import { CameraCapture } from './CameraCapture';
export function PhotoChecklistCapture({ files, onChange }: {
    files: EvidenceFiles;
    onChange: (files: EvidenceFiles) => void;
}) {
    const [chosen, setChosen] = useState<PhotoItem | null>(null);
    const next = chosen || REQUIRED_PHOTO_ITEMS.find(item => !files[item.key])?.key;
    const item = REQUIRED_PHOTO_ITEMS.find(row => row.key === next);
    const count = Object.keys(files).length;
    return <section className="space-y-4"><p role="status" className="font-semibold">Fotos capturadas: {count}/6</p><p className="text-sm text-gray-600">A câmera permanece aberta durante a sequência. Aponte para o item indicado; ela será encerrada ao completar as seis fotos ou cancelar.</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{REQUIRED_PHOTO_ITEMS.map(row => <button type="button" key={row.key} className={`rounded-xl border p-3 text-left text-sm ${files[row.key] ? 'border-green-300 bg-green-50' : 'bg-white'}`} onClick={() => setChosen(row.key)}>{row.label}<span className="block text-xs">{files[row.key] ? 'Capturado · refazer' : 'Pendente'}</span></button>)}</div>{item && <CameraCapture label={item.label} keepOpenAfterCapture onCapture={file => { onChange({ ...files, [item.key]: file }); setChosen(null); }}/>}</section>;
}
