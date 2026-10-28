export function EnvironmentSetup({ issues }: { issues: string[] }) {
  return <main className="min-h-screen bg-slate-100 px-5 py-12 text-slate-900">
    <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-lg sm:p-10">
      <p className="mb-3 text-sm font-bold text-red-700">SISTEMA PORTARIA · DESENVOLVIMENTO</p>
      <h1 className="mb-4 text-2xl font-bold">Preparar ambiente autorizado</h1>
      <p className="mb-5 text-slate-600">A aplicacao esta bloqueada para conexoes remotas. A estrategia atual utiliza o projeto original: siga ORIGINAL_ACCESS.md para o inventario somente leitura.</p>
      <ul className="mb-6 list-disc space-y-2 pl-5 text-sm text-slate-700">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
      <p className="rounded-xl bg-slate-100 p-4 text-sm">Para testar as melhorias agora, use <code>npm run dev:demo</code>. Para fixar o projeto original sem conectar, use <code>npm run original:configure</code> e <code>npm run dev:original</code>.</p>
      <p className="mt-5 text-sm text-slate-500">A configuracao original nao autoriza login, escrita ou publicacao. Nenhuma senha ou chave administrativa deve ser informada.</p>
    </section>
  </main>;
}
