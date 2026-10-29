import { reportError } from '../utils/diagnostics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Edit2,
  Filter,
  RotateCcw,
  Search,
  UserCheck,
  UserRoundPlus,
  UserX,
  Users,
} from 'lucide-react';
import { accessControlService } from '../services/accessControlService';
import type { PersonInput, PersonRecord, PersonType } from '../types/database';
import { Input } from './Input';
import { Textarea } from './Textarea';

interface PedestriansViewProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

type PersonTypeFilter = PersonType | 'Todos';
type PersonStatusFilter = 'Todos' | 'Ativos' | 'Inativos';

const PERSON_TYPES: PersonType[] = ['Funcionario', 'Terceirizado', 'Visitante'];

function createEmptyForm(): PersonInput {
  return {
    person_type: 'Funcionario',
    name: '',
    document_number: '',
    phone: '',
    company: '',
    notes: '',
    origin: 'manual',
    is_active: true,
  };
}

function getPersonTypeLabel(type: PersonType) {
  if (type === 'Funcionario') return 'Funcionário';
  return type;
}

function getPersonErrorMessage(error: unknown, action: 'cadastrar' | 'atualizar' | 'alterar') {
  const serviceError = error as { code?: string; message?: string; details?: string };
  const errorText = `${serviceError.message || ''} ${serviceError.details || ''}`.toLowerCase();

  if (serviceError.code === '23505' && errorText.includes('document')) {
    return 'Já existe uma pessoa cadastrada com este documento.';
  }

  if (serviceError.code === '23505') {
    return 'Já existe um cadastro com um dos dados informados.';
  }

  return `Não foi possível ${action} a pessoa. Tente novamente.`;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
        active
          ? 'border-green-200 bg-green-100 text-green-700'
          : 'border-gray-200 bg-gray-100 text-gray-600'
      }`}
    >
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function PersonTypeBadge({ type }: { type: PersonType }) {
  const tones: Record<PersonType, string> = {
    Funcionario: 'border-blue-200 bg-blue-50 text-blue-700',
    Terceirizado: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    Visitante: 'border-amber-200 bg-amber-50 text-amber-700',
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${tones[type]}`}>
      {getPersonTypeLabel(type)}
    </span>
  );
}

export function PedestriansView({ onSuccess, onError }: PedestriansViewProps) {
  const onErrorRef = useRef(onError);
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PersonInput>(createEmptyForm);
  const [search, setSearch] = useState('');
  const [personTypeFilter, setPersonTypeFilter] = useState<PersonTypeFilter>('Todos');
  const [statusFilter, setStatusFilter] = useState<PersonStatusFilter>('Todos');

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const loadPeople = useCallback(async () => {
    try {
      setLoading(true);
      const data = await accessControlService.listPeople({
        search,
        personType: personTypeFilter,
        status: statusFilter,
      });
      setPeople(data);
    } catch (error) {
      reportError('Erro ao carregar pessoas:', error);
      onErrorRef.current('Não foi possível carregar o cadastro de pessoas.');
    } finally {
      setLoading(false);
    }
  }, [personTypeFilter, search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(loadPeople, 250);
    return () => window.clearTimeout(timer);
  }, [loadPeople]);

  const summary = useMemo(
    () => ({
      total: people.length,
      active: people.filter((person) => person.is_active).length,
      inactive: people.filter((person) => !person.is_active).length,
    }),
    [people]
  );

  const resetForm = () => {
    setEditingId(null);
    setForm(createEmptyForm());
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      onError('Informe o nome da pessoa.');
      return;
    }

    try {
      setSaving(true);
      if (editingId) {
        await accessControlService.updatePerson(editingId, form);
        onSuccess('Pessoa atualizada com sucesso.');
      } else {
        await accessControlService.createPerson({ ...form, is_driver: false });
        onSuccess('Pessoa cadastrada com sucesso.');
      }
      resetForm();
      await loadPeople();
    } catch (error) {
      reportError('Erro ao salvar pessoa:', error);
      onError(getPersonErrorMessage(error, editingId ? 'atualizar' : 'cadastrar'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (person: PersonRecord) => {
    setEditingId(person.id);
    setForm({
      person_type: person.person_type,
      name: person.name,
      document_number: person.document_number || '',
      phone: person.phone || '',
      company: person.company || '',
      notes: person.notes || '',
      origin: person.origin,
      is_active: person.is_active,
    });
    document.getElementById('pedestrian-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleStatusChange = async (person: PersonRecord) => {
    const action = person.is_active ? 'desativar' : 'reativar';
    const confirmed = window.confirm(
      person.is_active
        ? `Desativar ${person.name}? O histórico será preservado.`
        : `Reativar ${person.name}? A pessoa voltará a aparecer em novos acessos.`
    );
    if (!confirmed) return;

    try {
      setStatusChangingId(person.id);
      if (person.is_active) {
        await accessControlService.deactivatePerson(person.id);
      } else {
        await accessControlService.reactivatePerson(person.id);
      }
      if (editingId === person.id) resetForm();
      onSuccess(person.is_active ? 'Pessoa desativada com sucesso.' : 'Pessoa reativada com sucesso.');
      await loadPeople();
    } catch (error) {
      reportError(`Erro ao ${action} pessoa:`, error);
      onError(getPersonErrorMessage(error, 'alterar'));
    } finally {
      setStatusChangingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-3 gap-3">
        {[
          { label: 'Resultados', value: summary.total, icon: Users, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'Ativos', value: summary.active, icon: UserCheck, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'Inativos', value: summary.inactive, icon: UserX, color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-2xl border p-3 shadow-sm sm:p-4 ${bg}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600 sm:text-xs">{label}</p>
              <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${color}`} />
            </div>
            <p className={`mt-2 text-2xl font-bold sm:text-3xl ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.4fr)]">
        <section id="pedestrian-form" className="glass scroll-mt-28 rounded-2xl p-5 shadow-premium sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <UserRoundPlus className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {editingId ? 'Editar pessoa' : 'Nova pessoa'}
              </h3>
              <p className="text-xs text-gray-500">Cadastro utilizado pelo controle de acesso da portaria.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-700">Tipo de pessoa *</span>
              <select
                value={form.person_type}
                onChange={(event) => setForm((current) => ({ ...current, person_type: event.target.value as PersonType }))}
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-gray-900 outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
              >
                {PERSON_TYPES.map((type) => (
                  <option key={type} value={type}>{getPersonTypeLabel(type)}</option>
                ))}
              </select>
            </label>

            <Input
              label="Nome completo"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nome da pessoa"
              required
            />
            <Input
              label="Documento"
              value={form.document_number || ''}
              onChange={(event) => setForm((current) => ({ ...current, document_number: event.target.value }))}
              placeholder="CPF, RG ou outro documento"
            />
            <Input
              label="Telefone"
              value={form.phone || ''}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              placeholder="Opcional"
            />
            <Input
              label="Empresa"
              value={form.company || ''}
              onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
              placeholder="Opcional"
            />
            <Textarea
              label="Observações"
              value={form.notes || ''}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Informações adicionais"
              rows={3}
            />

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">Pessoa ativa</p>
                <p className="text-xs text-gray-500">Somente pessoas ativas aparecem em novos acessos.</p>
              </div>
              <input
                type="checkbox"
                checked={form.is_active ?? true}
                onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                className="h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white hover:bg-black disabled:opacity-60"
              >
                {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar pessoa'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="glass rounded-2xl p-5 shadow-premium sm:p-6">
          <div className="mb-5 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Cadastro de pessoas</h3>
                <p className="text-xs text-gray-500">Funcionários, terceirizados e visitantes disponíveis para a portaria.</p>
              </div>
              {(search || personTypeFilter !== 'Todos' || statusFilter !== 'Todos') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setPersonTypeFilter('Todos');
                    setStatusFilter('Todos');
                  }}
                  className="text-left text-sm font-semibold text-red-700 hover:text-red-900"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar nome, documento, telefone, empresa ou código"
                className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-red-500 focus:ring-4 focus:ring-red-100"
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
                <Filter className="h-4 w-4 text-gray-500" />
                <select
                  value={personTypeFilter}
                  onChange={(event) => setPersonTypeFilter(event.target.value as PersonTypeFilter)}
                  className="w-full bg-transparent py-3 text-sm font-semibold text-gray-700 outline-none"
                >
                  <option value="Todos">Todos os tipos</option>
                  {PERSON_TYPES.map((type) => (
                    <option key={type} value={type}>{getPersonTypeLabel(type)}</option>
                  ))}
                </select>
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as PersonStatusFilter)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-700 outline-none"
              >
                <option value="Todos">Todos os status</option>
                <option value="Ativos">Ativos</option>
                <option value="Inativos">Inativos</option>
              </select>
            </div>
          </div>

          <div className="max-h-[860px] space-y-3 overflow-y-auto pr-1">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                Carregando pessoas...
              </div>
            ) : people.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                Nenhuma pessoa encontrada com esses filtros.
              </div>
            ) : (
              people.map((person) => (
                <article
                  key={person.id}
                  className={`rounded-2xl border bg-gray-50 p-4 ${
                    person.is_active ? 'border-gray-200' : 'border-gray-300 opacity-80'
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-gray-900">{person.name}</p>
                        <PersonTypeBadge type={person.person_type} />
                        <StatusBadge active={person.is_active} />
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-1 text-sm text-gray-600 sm:grid-cols-2">
                        <p>Código: {person.short_code || '-----'}</p>
                        <p>{person.document_number ? `Documento: ${person.document_number}` : 'Documento não informado'}</p>
                        <p>{person.phone?.trim() ? `Telefone: ${person.phone}` : 'Telefone não informado'}</p>
                        <p>{person.company?.trim() ? `Empresa: ${person.company}` : 'Empresa não informada'}</p>
                      </div>
                      {person.notes?.trim() && (
                        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-gray-600">{person.notes}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                      <button
                        type="button"
                        onClick={() => handleEdit(person)}
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        <Edit2 className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(person)}
                        disabled={statusChangingId === person.id}
                        className={`inline-flex items-center justify-center gap-1 rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                          person.is_active
                            ? 'border-red-200 text-red-700 hover:bg-red-50'
                            : 'border-green-200 text-green-700 hover:bg-green-50'
                        }`}
                      >
                        {person.is_active ? <UserX className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                        {statusChangingId === person.id
                          ? 'Alterando...'
                          : person.is_active
                          ? 'Desativar'
                          : 'Reativar'}
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
