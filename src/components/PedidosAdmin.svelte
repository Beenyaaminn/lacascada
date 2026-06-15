<script lang="ts">
  import { onMount } from 'svelte';
  import { type Pedido, type DetallePedido } from '../lib/types';

  let pedidos: (Pedido & { detalles?: DetallePedido[] })[] = $state([]);
  let loading: boolean = $state(true);
  let filterEstado: string = $state('hoy');
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let selectedPedido: (Pedido & { detalles?: DetallePedido[] }) | null = $state(null);
  let showPaymentModal: boolean = $state(false);
  let metodoPago: string = $state('efectivo');
  let turnoActivo: any | null = $state(null);
  let cajaActiva: any | null = $state(null);
  let totalHoy: number = $state(0);

  const hoy = new Date().toISOString().split('T')[0];

  onMount(async () => {
    await loadInfo();
    await loadPedidos();
    pollingInterval = setInterval(loadPedidos, 20000);
    return () => { if (pollingInterval) clearInterval(pollingInterval); };
  });

  async function loadInfo() {
    try {
      const [tRes, cRes] = await Promise.all([
        fetch('/api/admin/turnos?activo=1'),
        fetch('/api/admin/cajas?activa=1'),
      ]);
      const tData = await tRes.json();
      const cData = await cRes.json();
      turnoActivo = tData.turnos?.[0] || null;
      cajaActiva = cData.cajas?.[0] || null;
    } catch (e) { /* ignore */ }
  }

  async function loadPedidos() {
    try {
      let url = '/api/admin/pedidos';
      if (filterEstado === 'hoy') {
        const params = new URLSearchParams({ desde: hoy });
        url += '?' + params.toString();
      } else if (filterEstado) {
        url += `?estado=${filterEstado}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      pedidos = data.pedidos || [];

      let params = new URLSearchParams({ desde: hoy });
      const hoyRes = await fetch('/api/admin/pedidos?' + params.toString());
      const hoyData = await hoyRes.json();
      totalHoy = (hoyData.pedidos || []).reduce((s: number, p: any) => s + (p.estado !== 'cancelado' ? p.total : 0), 0);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      loading = false;
    }
  }

  function onFilterChange() {
    loading = true;
    loadPedidos();
  }

  async function cambiarEstado(pedido: Pedido, nuevoEstado: string) {
    try {
      const res = await fetch('/api/admin/pedidos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pedido.id, estado: nuevoEstado }),
      });
      if (res.ok) loadPedidos();
    } catch (e) { console.error('Error:', e); }
  }

  async function cargarDetalles(pedido: Pedido) {
    try {
      const res = await fetch(`/api/admin/pedidos/${pedido.id}/detalles`);
      const data = await res.json();
      selectedPedido = { ...pedido, detalles: data.detalles || [] };
    } catch (e) {
      selectedPedido = { ...pedido, detalles: [] };
    }
  }

  function openPayment(pedido: Pedido) {
    cargarDetalles(pedido).then(() => { showPaymentModal = true; });
  }

  async function procesarPago() {
    if (!selectedPedido) return;
    try {
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: selectedPedido.id, metodo_pago: metodoPago }),
      });
      if (res.ok) {
        const data = await res.json();
        showPaymentModal = false;
        if (data.voucher) {
          const v = data.voucher;
          const params = new URLSearchParams({
            pedido_id: String(v.pedido_id),
            fecha: new Date(v.fecha_hora).toLocaleString('es-CL'),
            mesa: v.mesa_info,
            metodo_pago: v.metodo_pago,
            total: String(v.total),
            detalles: JSON.stringify(v.detalles),
          });
          window.open(`/admin/voucher?${params.toString()}`, '_blank');
        }
        loadPedidos();
      }
    } catch (e) { console.error('Error:', e); }
  }

  function getEstadoBadge(estado: string): string {
    switch (estado) {
      case 'pendiente': return 'bg-yellow-100 text-yellow-700';
      case 'en_preparacion': return 'bg-blue-100 text-blue-700';
      case 'entregado': return 'bg-green-100 text-green-700';
      case 'pagado': return 'bg-gray-100 text-gray-700';
      case 'cancelado': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  function formatCLP(n: number): string { return '$' + n.toLocaleString('es-CL'); }
</script>

<div class="p-4 sm:p-6">
  <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
    <h2 class="text-xl font-bold text-gray-900">Pedidos</h2>
    <div class="flex items-center gap-4 text-xs">
      {#if turnoActivo}
        <span class="text-gray-500">Turno: <span class="font-medium text-gray-700">#{turnoActivo.id} {turnoActivo.tipo_turno === 'manana' ? 'Mañana' : turnoActivo.tipo_turno === 'medio_dia' ? 'Medio Día' : 'Noche'}</span></span>
      {/if}
      {#if cajaActiva}
        <span class="text-gray-500">Caja: <span class="font-medium text-gray-700">#{cajaActiva.id} ({formatCLP(cajaActiva.efectivo_inicial)})</span></span>
      {/if}
      <span class="text-brand-700 font-bold">Total hoy: {formatCLP(totalHoy)}</span>
    </div>
  </div>

  <div class="flex gap-2 mb-6 flex-wrap">
    <button class="px-3 py-1 rounded-full text-xs font-medium transition-colors {filterEstado === 'hoy' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700'}" onclick={() => { filterEstado = 'hoy'; onFilterChange(); }}>Hoy</button>
    <button class="px-3 py-1 rounded-full text-xs font-medium transition-colors {filterEstado === '' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700'}" onclick={() => { filterEstado = ''; onFilterChange(); }}>Todos</button>
    <button class="px-3 py-1 rounded-full text-xs font-medium transition-colors {filterEstado === 'pendiente' ? 'bg-yellow-500 text-white' : 'bg-yellow-100 text-yellow-700'}" onclick={() => { filterEstado = 'pendiente'; onFilterChange(); }}>Pendientes</button>
    <button class="px-3 py-1 rounded-full text-xs font-medium transition-colors {filterEstado === 'en_preparacion' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700'}" onclick={() => { filterEstado = 'en_preparacion'; onFilterChange(); }}>En preparación</button>
    <button class="px-3 py-1 rounded-full text-xs font-medium transition-colors {filterEstado === 'entregado' ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'}" onclick={() => { filterEstado = 'entregado'; onFilterChange(); }}>Entregados</button>
    <button class="px-3 py-1 rounded-full text-xs font-medium transition-colors {filterEstado === 'pagado' ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-700'}" onclick={() => { filterEstado = 'pagado'; onFilterChange(); }}>Pagados</button>
  </div>

  {#if loading}
    <div class="text-center py-12 text-gray-500">Cargando...</div>
  {:else if pedidos.length === 0}
    <div class="text-center py-12 text-gray-500">No hay pedidos {filterEstado === 'hoy' ? 'hoy' : ''}</div>
  {:else}
    <div class="space-y-3">
      {#each pedidos as pedido (pedido.id)}
        <div class="card p-4">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-900">#{pedido.id}</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-medium {getEstadoBadge(pedido.estado)}">{pedido.estado.replace(/_/g, ' ')}</span>
                {#if pedido.metodo_pago}
                  <span class="text-xs text-gray-500">{pedido.metodo_pago}</span>
                {/if}
              </div>
              <p class="text-sm text-gray-500 mt-1">
                {pedido.tipo_pedido === 'mesa' && pedido.mesa_numero ? `Piso ${pedido.mesa_piso} - Mesa ${pedido.mesa_numero}` : pedido.tipo_pedido}
                <span class="mx-2">|</span>
                {new Date(pedido.fecha_hora).toLocaleString('es-CL')}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-brand-700">{formatCLP(pedido.total)}</span>
              {#if pedido.estado === 'pendiente'}
                <button class="btn-primary text-xs" onclick={() => cambiarEstado(pedido, 'en_preparacion')}>Preparar</button>
              {:else if pedido.estado === 'en_preparacion'}
                <button class="btn-primary text-xs" onclick={() => cambiarEstado(pedido, 'entregado')}>Entregar</button>
              {:else if pedido.estado === 'entregado' && !pedido.metodo_pago}
                <button class="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1 px-3 rounded-lg text-xs" onclick={() => openPayment(pedido)}>Cobrar</button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Payment Modal -->
{#if showPaymentModal && selectedPedido}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
    <div class="absolute inset-0 bg-black/50" onclick={() => { showPaymentModal = false }}></div>
    <div class="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 z-10">
      <h3 class="text-lg font-bold mb-4">Cobrar Pedido #{selectedPedido.id}</h3>
      <div class="bg-gray-50 rounded-lg p-3 mb-4">
        <p class="text-sm text-gray-600">Total a cobrar:</p>
        <p class="text-2xl font-bold text-brand-700">{formatCLP(selectedPedido.total)}</p>
        {#if selectedPedido.mesa_numero}
          <p class="text-xs text-gray-500 mt-1">Piso {selectedPedido.mesa_piso} - Mesa {selectedPedido.mesa_numero}</p>
        {/if}
      </div>
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
        <div class="grid grid-cols-2 gap-2">
          {#each ['efectivo', 'debito', 'credito', 'a_credito'] as metodo}
            <label class="flex items-center gap-2 p-2 rounded-lg border cursor-pointer {metodoPago === metodo ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}">
              <input type="radio" bind:group={metodoPago} value={metodo} class="text-brand-600" />
              <span class="text-sm capitalize">{metodo.replace('_', ' ')}</span>
            </label>
          {/each}
        </div>
      </div>
      <div class="flex gap-3">
        <button class="btn-secondary flex-1" onclick={() => { showPaymentModal = false }}>Cancelar</button>
        <button class="btn-primary flex-1" onclick={procesarPago}>Cobrar {formatCLP(selectedPedido.total)}</button>
      </div>
    </div>
  </div>
{/if}
