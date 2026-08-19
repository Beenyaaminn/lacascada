<script lang="ts">
  import { onMount } from 'svelte';

  let reservas: any[] = $state([]);
  let loading: boolean = $state(true);
  let showModal: boolean = $state(false);
  let showAsignarModal: boolean = $state(false);
  let asignarReserva: any = $state(null);
  let mesasDisponibles: any[] = $state([]);

  let form = $state({ nombre_cliente: '', comensales: 2, fecha: new Date().toISOString().split('T')[0], hora: '' });

  onMount(async () => {
    await loadReservas();
  });

  async function loadReservas() {
    try {
      const res = await fetch('/api/admin/reservas');
      const data = await res.json();
      reservas = data.reservas || [];
    } catch (e) { console.error(e); }
    finally { loading = false; }
  }

  let saving: boolean = $state(false);

  async function handleCreate() {
    if (saving) return;
    saving = true;
    try {
      const res = await fetch('/api/admin/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        showModal = false;
        form = { nombre_cliente: '', comensales: 2, fecha: new Date().toISOString().split('T')[0], hora: '' };
        loadReservas();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al crear reserva');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    } finally {
      saving = false;
    }
  }

  async function cambiarEstado(id: number, estado: string) {
    try {
      const res = await fetch('/api/admin/reservas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Error al cambiar estado');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    }
    loadReservas();
  }

  async function abrirAsignarMesa(r: any) {
    asignarReserva = r;
    try {
      const res = await fetch('/api/mesas/disponibles');
      const data = await res.json();
      mesasDisponibles = (data.mesas || []).filter((m: any) => m.estado === 'libre').sort((a: any, b: any) => a.piso * 100 + a.numero_mesa - (b.piso * 100 + b.numero_mesa));
    } catch (e) { mesasDisponibles = []; }
    showAsignarModal = true;
  }

  async function confirmarAsignacion(mesa: any) {
    if (!asignarReserva) return;
    try {
      const res = await fetch('/api/admin/reservas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: asignarReserva.id, estado: 'confirmada', mesa_id: mesa.id }),
      });
      if (res.ok) {
        showAsignarModal = false;
        loadReservas();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al asignar mesa');
      }
    } catch (e) { alert('Error de conexión'); }
  }

  function getEstadoBadge(estado: string): string {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-700';
      case 'confirmada': return 'bg-green-100 text-green-700';
      case 'cancelada': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100';
    }
  }

  function formatHora(h: string | null): string {
    if (!h) return '—';
    return h.slice(0, 5);
  }
</script>

<div class="p-4 sm:p-6">
  <div class="flex items-center justify-between mb-6">
    <h2 class="text-xl font-bold text-gray-900">Reservas de Mesa</h2>
    <button class="btn-primary" onclick={() => { showModal = true }}>+ Nueva Reserva</button>
  </div>

  {#if loading}
    <div class="text-center py-12 text-gray-500">Cargando...</div>
  {:else if reservas.length === 0}
    <div class="text-center py-12 text-gray-500">No hay reservas registradas</div>
  {:else}
    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="text-left p-3 font-medium text-gray-600">Cliente</th>
              <th class="text-center p-3 font-medium text-gray-600">Comensales</th>
              <th class="text-center p-3 font-medium text-gray-600">Fecha</th>
              <th class="text-center p-3 font-medium text-gray-600">Hora</th>
              <th class="text-center p-3 font-medium text-gray-600">Estado</th>
              <th class="text-center p-3 font-medium text-gray-600">Mesa</th>
              <th class="text-right p-3 font-medium text-gray-600">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {#each reservas as r (r.id)}
              <tr class="hover:bg-gray-50">
                <td class="p-3 font-medium">{r.nombre_cliente}</td>
                <td class="p-3 text-center">{r.cantidad || 1} pers.</td>
                <td class="p-3 text-center text-xs">{new Date(r.fecha).toLocaleDateString('es-CL')}</td>
                <td class="p-3 text-center text-xs font-mono">{formatHora((r as any).hora)}</td>
                <td class="p-3 text-center">
                  <span class="px-2 py-0.5 rounded-full text-xs {getEstadoBadge(r.estado)}">{r.estado}</span>
                </td>
                <td class="p-3 text-center text-xs text-gray-500">{r.mesa_info || '—'}</td>
                <td class="p-3 text-right">
                  {#if r.estado === 'pendiente'}
                    <div class="flex gap-1 justify-end">
                      <button class="text-xs text-blue-600 hover:text-blue-800" onclick={() => abrirAsignarMesa(r)}>Asignar mesa</button>
                      <button class="text-xs text-red-600 hover:text-red-800" onclick={() => cambiarEstado(r.id, 'cancelada')}>Cancelar</button>
                    </div>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<!-- Create Modal -->
{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
    <div class="absolute inset-0 bg-black/50" onclick={() => { showModal = false }}></div>
    <div class="relative bg-white rounded-2xl w-full max-w-md p-6 z-10">
      <h3 class="text-lg font-bold mb-4">Nueva Reserva de Mesa</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Nombre del Cliente</label>
          <input class="input-field" bind:value={form.nombre_cliente} required />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Comensales</label>
          <input class="input-field" type="number" bind:value={form.comensales} min="1" max="20" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input class="input-field" type="date" bind:value={form.fecha} />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Hora</label>
            <input class="input-field" type="time" bind:value={form.hora} />
          </div>
        </div>
        <div class="flex gap-3 pt-3">
          <button class="btn-secondary flex-1" onclick={() => { showModal = false }}>Cancelar</button>
          <button class="btn-primary flex-1" disabled={saving} onclick={handleCreate}>{saving ? 'Guardando...' : 'Reservar'}</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Asignar Mesa Modal -->
{#if showAsignarModal && asignarReserva}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
    <div class="absolute inset-0 bg-black/50" onclick={() => { showAsignarModal = false }}></div>
    <div class="relative bg-white rounded-2xl w-full max-w-md p-6 z-10">
      <h3 class="text-lg font-bold mb-2">Asignar Mesa a {asignarReserva.nombre_cliente}</h3>
      <p class="text-sm text-gray-500 mb-4">{asignarReserva.cantidad || 1} comensales · {new Date(asignarReserva.fecha).toLocaleDateString('es-CL')} {formatHora(asignarReserva.hora)}</p>
      {#if mesasDisponibles.length === 0}
        <p class="text-center text-gray-400 py-6">No hay mesas disponibles</p>
      {:else}
        <div class="grid grid-cols-4 gap-2 mb-4">
          {#each mesasDisponibles as m (m.id)}
            <button class="aspect-square rounded-xl border-2 border-gray-200 hover:border-brand-500 hover:bg-brand-50 transition-all flex flex-col items-center justify-center gap-1" onclick={() => confirmarAsignacion(m)}>
              <span class="text-lg">🍽️</span>
              <span class="text-xs font-semibold text-gray-700">{m.piso === 3 ? `PUB S${m.numero_mesa}` : `P${m.piso} M${m.numero_mesa}`}</span>
            </button>
          {/each}
        </div>
      {/if}
      <button class="btn-secondary w-full" onclick={() => { showAsignarModal = false }}>Cerrar</button>
    </div>
  </div>
{/if}
