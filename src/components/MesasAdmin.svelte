<script lang="ts">
  import { onMount } from 'svelte';
  import { type Mesa } from '../lib/types';
  import TomaPedidoModal from './TomaPedidoModal.svelte';

  let mesas: Mesa[] = $state([]);
  let reservas: any[] = $state([]);
  let deliveryOrders: any[] = $state([]);
  let activePiso: number = $state(1);
  let activeTab: string = $state('mesas');
  let loading: boolean = $state(true);
  let lastUpdate: Date = $state(new Date());
  let updating: boolean = $state(false);
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let now: Date = $state(new Date());
  let operationInFlight: boolean = $state(false);
  let timers: Map<number, number> = new Map();
  let showModal: boolean = $state(false);
  let modalMesa: Mesa | null = $state(null);
  let clockOffset: number = $state(0);

  let showCobroDelivery: boolean = $state(false);
  let cobroDeliveryPedido: any | null = $state(null);
  let cobroDeliveryDetalles: any[] = $state([]);
  let metodoPagoDelivery: string = $state('efectivo');
  let efectivoConCuantoDelivery: number = $state(0);
  let cobrandoDelivery: boolean = $state(false);

  onMount(() => {
    loadData();
    pollingInterval = setInterval(() => {
      if (document.visibilityState === 'visible') loadData();
    }, 30000);
    timerInterval = setInterval(() => {
      now = new Date();
    }, 5000);
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
      if (timerInterval) clearInterval(timerInterval);
    };
  });

  async function loadData(force = false) {
    if (operationInFlight && !force) return;
    operationInFlight = true;
    updating = true;
    try {
      const [mesasRes, reservasRes, deliveryRes] = await Promise.all([
        fetch('/api/admin/mesas?_t=' + Date.now(), { cache: 'no-store' }),
        fetch('/api/admin/reservas?_t=' + Date.now(), { cache: 'no-store' }),
        fetch('/api/admin/pedidos?tipo=delivery&_t=' + Date.now(), { cache: 'no-store' }),
      ]);
      const mesasData = await mesasRes.json();
      mesas = mesasData.mesas || [];

      if (mesasData.server_time) {
        clockOffset = new Date(mesasData.server_time).getTime() - Date.now();
      }

      for (const m of mesas) {
        if (m.estado === 'ocupada' && m.tomada_desde) {
          if (force || !timers.has(m.id)) {
            timers.set(m.id, new Date(m.tomada_desde).getTime());
          }
        }
        if (m.estado !== 'ocupada') {
          timers.delete(m.id);
        }
      }
      const reservasData = await reservasRes.json();
      reservas = reservasData.reservas || [];
      const deliveryData = await deliveryRes.json();
      deliveryOrders = deliveryData.pedidos || [];
      lastUpdate = new Date();
    } catch (e) {
      console.error('Error cargando datos:', e);
    } finally {
      updating = false;
      operationInFlight = false;
      loading = false;
    }
  }

  function getMesasPiso(piso: number): Mesa[] {
    return mesas.filter(m => m.piso === piso).sort((a, b) => a.numero_mesa - b.numero_mesa);
  }

  function getEstadoColor(estado: string): string {
    switch (estado) {
      case 'libre': return 'bg-emerald-500';
      case 'ocupada': return 'bg-red-500';
      case 'esperando_pago': return 'bg-amber-500';
      default: return 'bg-gray-400';
    }
  }

  function getEstadoLabel(estado: string): string {
    switch (estado) {
      case 'libre': return 'Libre';
      case 'ocupada': return 'Ocupada';
      case 'esperando_pago': return 'Esp. pago';
      default: return estado;
    }
  }

  function getElapsed(mesaId: number): string {
    const start = timers.get(mesaId);
    if (!start) return '00:00';
    const serverNow = now.getTime() + clockOffset;
    const diff = Math.max(0, Math.floor((serverNow - start) / 1000));
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async function cambiarEstado(mesa: Mesa) {
    if (operationInFlight) return;
    operationInFlight = true;

    const estados = ['libre', 'ocupada', 'esperando_pago'];
    const idxActual = estados.indexOf(mesa.estado);
    const nuevoEstado = estados[(idxActual + 1) % estados.length];

    const mesaOriginal = { ...mesa };
    const ahora = new Date().toISOString();

    if (nuevoEstado === 'ocupada') {
      timers.set(mesa.id, Date.now() + clockOffset);
    } else {
      timers.delete(mesa.id);
    }

    mesas = mesas.map(m => {
      if (m.id !== mesa.id) return m;
      if (nuevoEstado === 'ocupada') {
        return { ...m, estado: nuevoEstado as any, tomada_desde: ahora, tomada_por: null as any };
      }
      return { ...m, estado: nuevoEstado as any, tomada_desde: null as any, tomada_por: null as any };
    });

    try {
      const res = await fetch('/api/admin/mesas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mesa.id, estado: nuevoEstado }),
      });
      if (res.ok) {
        const data = await res.json();
        mesas = mesas.map(m => m.id === mesa.id ? data.mesa : m);
      } else {
        mesas = mesas.map(m => m.id === mesa.id ? mesaOriginal : m);
        if (mesaOriginal.estado === 'ocupada' && nuevoEstado !== 'ocupada') {
          timers.set(mesa.id, new Date(mesaOriginal.tomada_desde!).getTime());
        } else if (mesaOriginal.estado !== 'ocupada') {
          timers.delete(mesa.id);
        }
      }
    } catch (e) {
      console.error('Error:', e);
      mesas = mesas.map(m => m.id === mesa.id ? mesaOriginal : m);
      if (mesaOriginal.estado === 'ocupada' && nuevoEstado !== 'ocupada') {
        timers.set(mesa.id, new Date(mesaOriginal.tomada_desde!).getTime());
      } else if (mesaOriginal.estado !== 'ocupada') {
        timers.delete(mesa.id);
      }
    } finally {
      operationInFlight = false;
    }
  }

  function countByEstado(estado: string): number {
    return mesas.filter(m => m.estado === estado).length;
  }

  function formatMesa(num: number): string {
    return `Mesa ${String(num).padStart(2, '0')}`;
  }

  async function cambiarEstadoDelivery(pedidoId: number, estado: string) {
    try {
      const res = await fetch('/api/admin/pedidos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pedidoId, estado }),
      });
      if (res.ok) loadData(true);
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

  async function abrirModal(mesa: Mesa) {
    try {
      const res = await fetch('/api/admin/mesas/bloquear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesa_id: mesa.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Mesa no disponible');
        return;
      }
    } catch (e) { /* si falla el bloqueo, permitir igual */ }
    modalMesa = mesa;
    showModal = true;
  }

  async function cerrarModal() {
    if (modalMesa) {
      mesas = mesas.map(m => m.id === modalMesa!.id ? { ...m, estado: 'libre' as any, tomada_por: null as any, tomada_desde: null as any } : m);
      timers.delete(modalMesa.id);
      await fetch(`/api/admin/mesas/bloquear?id=${modalMesa.id}`, { method: 'DELETE' }).catch(() => {});
    }
    showModal = false;
    modalMesa = null;
    loadData(true);
  }

  async function cobrarDelivery(pedido: any) {
    cobroDeliveryPedido = pedido;
    cobroDeliveryDetalles = [];
    metodoPagoDelivery = 'efectivo';
    efectivoConCuantoDelivery = pedido.total || 0;
    showCobroDelivery = true;
    try {
      const res = await fetch(`/api/admin/pedidos/${pedido.id}/detalles`);
      const data = await res.json();
      cobroDeliveryDetalles = data.detalles || [];
    } catch (e) { /* fallback */ }
  }

  async function procesarCobroDelivery() {
    if (!cobroDeliveryPedido) return;
    cobrandoDelivery = true;
    try {
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: cobroDeliveryPedido.id,
          metodo_pago: metodoPagoDelivery,
          efectivo_con_cuanto: metodoPagoDelivery === 'efectivo' ? efectivoConCuantoDelivery : 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        showCobroDelivery = false;
        if (data.voucher) {
          window.open(`/admin/voucher?pedido_id=${data.voucher.pedido_id}`, '_blank');
        }
        loadData(true);
      } else {
        const err = await res.json();
        alert(err.error || 'Error al procesar pago');
      }
    } catch (e) { alert('Error de conexión'); }
    finally { cobrandoDelivery = false; }
  }

  const tabs = [
    { id: 'mesas', label: 'Todo el local', icon: '🏠' },
    { id: 'reservas', label: 'Reservas', icon: '📅' },
    { id: 'delivery', label: 'Delivery', icon: '🛵' },
  ];

  function tabCount(id: string): number {
    if (id === 'mesas') return mesas.filter(m => m.estado !== 'libre').length;
    if (id === 'reservas') return reservas.filter((r: any) => r.estado === 'pendiente').length;
    if (id === 'delivery') return deliveryOrders.filter((d: any) => d.estado !== 'pagado' && d.estado !== 'cancelado').length;
    return 0;
  }
</script>

<div class="max-w-5xl mx-auto px-4 py-6">
  <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
    <h2 class="text-2xl font-bold text-gray-900">Toma de Pedidos</h2>
    <div class="flex items-center gap-3">
      <span class="text-xs text-gray-500 flex items-center gap-1.5">
        {#if updating}
          <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          Actualizando...
        {:else}
          <span class="w-2 h-2 rounded-full bg-green-500"></span>
          Act. {lastUpdate.toLocaleTimeString('es-CL')}
        {/if}
      </span>
      <button
        class="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium flex items-center gap-1 disabled:opacity-50"
        onclick={loadData}
        disabled={updating}
      >
        <span>↻</span> Refrescar
      </button>
    </div>
  </div>

  {#if loading}
    <div class="text-center py-12 text-gray-500">Cargando...</div>
  {:else}
    <!-- Tab Navigation -->
    <nav class="flex gap-1 mb-6 border-b border-gray-200">
      {#each tabs as tab}
        <button
          class="relative px-5 py-3 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-[1px]
            {activeTab === tab.id
              ? 'border-brand-600 text-brand-700 bg-brand-50'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
          onclick={() => { activeTab = tab.id }}
        >
          <span class="mr-1.5">{tab.icon}</span>{tab.label}
          {#if tabCount(tab.id) > 0 && activeTab !== tab.id}
            <span class="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">{tabCount(tab.id)}</span>
          {/if}
        </button>
      {/each}
    </nav>

    <!-- ===== TODO EL LOCAL ===== -->
    {#if activeTab === 'mesas'}
      <!-- Piso Tabs -->
      <div class="flex gap-2 mb-5">
        {#each [1, 2] as piso}
          <button
            class="px-5 py-2 rounded-full text-sm font-medium transition-colors
              {activePiso === piso
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white text-gray-700 border border-gray-200 hover:border-brand-300'}"
            onclick={() => { activePiso = piso }}
          >
            Piso {piso}
          </button>
        {/each}
      </div>

      <!-- Legend -->
      <div class="flex gap-5 mb-5 flex-wrap text-sm">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span class="text-gray-600">Libre ({countByEstado('libre')})</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-red-500"></div>
          <span class="text-gray-600">Ocupada ({countByEstado('ocupada')})</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 rounded-full bg-amber-500"></div>
          <span class="text-gray-600">Esp. pago ({countByEstado('esperando_pago')})</span>
        </div>
      </div>

      <!-- Mesa Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {#each getMesasPiso(activePiso) as mesa (mesa.id)}
          <div
            class="relative card p-4 hover:shadow-lg transition-all cursor-pointer text-center border-2
              {mesa.estado === 'libre'
                ? 'border-emerald-200 hover:border-emerald-300'
                : mesa.estado === 'ocupada'
                ? 'border-red-200 hover:border-red-300 bg-red-50/30'
                : 'border-amber-200 hover:border-amber-300 bg-amber-50/30'}"
            onclick={() => abrirModal(mesa)}
            role="button"
            tabindex="0"
            onkeydown={(e) => { if (e.key === 'Enter') abrirModal(mesa) }}
          >
            <!-- Toggle estado (mini button) -->
            <button
              class="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs
                {mesa.estado === 'libre' ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : mesa.estado === 'ocupada' ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}"
              onclick={(e) => { e.stopPropagation(); cambiarEstado(mesa); }}
              title="Cambiar estado"
            >↻</button>
            <!-- Fork & Knife Icon -->
            <div class="mb-2 flex justify-center">
              <svg class="w-9 h-9 transition-colors duration-300 {mesa.estado === 'libre' ? 'text-gray-300' : mesa.estado === 'ocupada' ? 'text-red-500' : 'text-amber-500'}" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <!-- Fork -->
                <path d="M5 0v8c0 2 1.5 3.5 3.5 3.5v12H10v-12C12 11.5 13.5 10 13.5 8V0H12v7.5c0 .3-.2.5-.5.5s-.5-.2-.5-.5V0H9.5v7.5c0 .3-.2.5-.5.5s-.5-.2-.5-.5V0H7v7.5c0 .3-.2.5-.5.5s-.5-.2-.5-.5V0H5z" transform="translate(0,0)"/>
                <!-- Knife -->
                <path d="M15 0v14c0 2.5 2 3.5 3 4.5v5h1v-5c1-1 3-2 3-4.5V0h-1.5v13.5c0 .8-.5 1.5-1.5 2V0h-1.5v15.5c-1-.5-1.5-1.2-1.5-2V0H15z" transform="translate(1,0)"/>
              </svg>
            </div>

            <!-- Mesa Name -->
            <p class="font-bold text-gray-900 text-sm mb-0.5">{formatMesa(mesa.numero_mesa)}</p>

            <!-- Estado dot + label -->
            <div class="flex items-center justify-center gap-1.5 mb-1">
              <span class="w-2 h-2 rounded-full {getEstadoColor(mesa.estado)}"></span>
              <span class="text-xs text-gray-500">{getEstadoLabel(mesa.estado)}</span>
            </div>

            <!-- Garzón + Timer (solo ocupada) -->
            {#if mesa.estado === 'ocupada'}
              <div class="border-t border-red-100 pt-2 mt-1">
                {#if mesa.tomada_por}
                  <p class="text-xs text-gray-600 font-medium flex items-center justify-center gap-1">
                    <svg class="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {mesa.tomada_por}
                  </p>
                {/if}
                <p class="text-xs font-mono text-red-500 font-semibold mt-0.5 tracking-wider">
                  ⏱ {getElapsed(mesa.id)}
                </p>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <p class="text-xs text-gray-400 text-center mt-6">Click en una mesa para cambiar su estado</p>

    <!-- ===== RESERVAS ===== -->
    {:else if activeTab === 'reservas'}
      {#if reservas.length === 0}
        <div class="text-center py-16 text-gray-400">
          <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p class="text-lg font-medium">Sin reservas</p>
          <p class="text-sm mt-1">No hay reservas activas por el momento</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each reservas as reserva (reserva.id)}
            <div class="card p-4 border-l-4 {reserva.estado === 'pendiente' ? 'border-blue-400' : reserva.estado === 'entregada' ? 'border-green-400' : 'border-red-400'}">
              <div class="flex justify-between items-start mb-2">
                <h3 class="font-semibold text-gray-900">{reserva.nombre_cliente}</h3>
                <span class="text-xs px-2 py-0.5 rounded-full {reserva.estado === 'pendiente' ? 'bg-blue-100 text-blue-700' : reserva.estado === 'entregada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                  {reserva.estado}
                </span>
              </div>
              <p class="text-sm text-gray-600">{reserva.producto_nombre || 'Plato #' + reserva.producto_id}</p>
              <div class="flex justify-between items-center mt-2 text-xs text-gray-500">
                <span>Cant: {reserva.cantidad}</span>
                <span>{new Date(reserva.fecha).toLocaleDateString('es-CL')}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}

    <!-- ===== DELIVERY ===== -->
    {:else if activeTab === 'delivery'}
      {#if deliveryOrders.length === 0}
        <div class="text-center py-16 text-gray-400">
          <svg class="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
          </svg>
          <p class="text-lg font-medium">Sin pedidos delivery</p>
          <p class="text-sm mt-1">No hay pedidos delivery activos por el momento</p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each deliveryOrders as pedido (pedido.id)}
            <div class="card p-4 border-l-4 {pedido.estado === 'pendiente' ? 'border-yellow-400' : pedido.estado === 'en_preparacion' ? 'border-blue-400' : pedido.estado === 'entregado' ? 'border-green-400' : 'border-gray-300'}">
              <div class="flex items-start justify-between flex-wrap gap-3">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-2xl">{pedido.tipo_pedido === 'retiro' ? '🏃' : '🛵'}</span>
                    <span class="font-bold text-gray-900">#{pedido.id}</span>
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium {getEstadoBadge(pedido.estado)}">{pedido.estado.replace(/_/g, ' ')}</span>
                    {#if pedido.tipo_pedido === 'retiro'}<span class="text-xs text-purple-600 font-medium">Retiro</span>{/if}
                    {#if pedido.metodo_pago}
                      <span class="text-xs text-gray-500 capitalize">{pedido.metodo_pago.replace('_', ' ')}</span>
                    {/if}
                  </div>
                  <p class="font-semibold text-gray-800">{pedido.nombre_cliente || 'Cliente'}</p>
                  {#if pedido.telefono}
                    <p class="text-sm text-gray-500">📞 {pedido.telefono}</p>
                  {/if}
                  {#if pedido.direccion}
                    <p class="text-sm text-gray-500">📍 {pedido.direccion}</p>
                  {/if}
                  <p class="text-xs text-gray-400 mt-1">{new Date(pedido.fecha_hora).toLocaleString('es-CL')}</p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-brand-700 text-lg">${pedido.total.toLocaleString('es-CL')}</span>
                  {#if pedido.estado === 'pendiente'}
                    <button class="btn-primary text-xs px-3 py-1.5" onclick={() => cambiarEstadoDelivery(pedido.id, 'en_preparacion')}>Preparar</button>
                  {:else if pedido.estado === 'en_preparacion'}
                    <button class="btn-primary text-xs px-3 py-1.5" onclick={() => cambiarEstadoDelivery(pedido.id, 'entregado')}>Entregar</button>
                  {:else if pedido.estado === 'entregado' && !pedido.metodo_pago}
                    <button class="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-1 px-3 rounded-lg text-xs" onclick={() => cobrarDelivery(pedido)}>Cobrar</button>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}

  <!-- Toma de Pedido Modal -->
  {#if showModal && modalMesa}
    <TomaPedidoModal mesa={modalMesa} onclose={cerrarModal} />
  {/if}

  <!-- Cobro Delivery Modal -->
  {#if showCobroDelivery && cobroDeliveryPedido}
    <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
      <div class="absolute inset-0 bg-black/50" onclick={() => { showCobroDelivery = false }}></div>
      <div class="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 z-10">
        <h3 class="text-lg font-bold mb-4">Cobrar Delivery #{cobroDeliveryPedido.id}</h3>
        <div class="bg-gray-50 rounded-lg p-3 mb-4">
          <p class="text-sm text-gray-600">Total a cobrar:</p>
          <p class="text-2xl font-bold text-brand-700">${cobroDeliveryPedido.total.toLocaleString('es-CL')}</p>
          <p class="text-xs text-gray-500 mt-1">🛵 {cobroDeliveryPedido.nombre_cliente || 'Delivery'}</p>
          {#if cobroDeliveryPedido.direccion}
            <p class="text-xs text-gray-400">📍 {cobroDeliveryPedido.direccion}</p>
          {/if}
          {#if cobroDeliveryDetalles.length > 0}
            <div class="border-t border-gray-200 mt-2 pt-2">
              <p class="text-xs font-semibold text-gray-600 mb-1">Productos:</p>
              {#each cobroDeliveryDetalles as d}
                <p class="text-xs text-gray-700">{d.cantidad}x {d.producto_nombre || '#' + d.producto_id} {#if d.acompanamiento && d.acompanamiento !== 'Sin acompañamiento'}<span class="text-gray-400">({d.acompanamiento})</span>{/if} — ${(d.subtotal || 0).toLocaleString('es-CL')}</p>
              {/each}
            </div>
          {/if}
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">Método de pago</label>
          <div class="grid grid-cols-2 gap-2">
            {#each ['efectivo', 'debito', 'credito'] as metodo}
              <label class="flex items-center gap-2 p-2 rounded-lg border cursor-pointer {metodoPagoDelivery === metodo ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}">
                <input type="radio" bind:group={metodoPagoDelivery} value={metodo} class="text-brand-600" />
                <span class="text-sm capitalize">{metodo === 'efectivo' ? 'Efectivo' : metodo}</span>
              </label>
            {/each}
          </div>
        </div>
        {#if metodoPagoDelivery === 'efectivo'}
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Con cuánto paga</label>
            <input type="number" bind:value={efectivoConCuantoDelivery} min={cobroDeliveryPedido.total} class="input-field w-full" />
            {#if efectivoConCuantoDelivery > cobroDeliveryPedido.total}
              <p class="text-sm text-green-600 mt-1">Vuelto: ${(efectivoConCuantoDelivery - cobroDeliveryPedido.total).toLocaleString('es-CL')}</p>
            {/if}
          </div>
        {/if}
        <div class="flex gap-3">
          <button class="btn-secondary flex-1" onclick={() => { showCobroDelivery = false }}>Cancelar</button>
          <button class="btn-primary flex-1" onclick={procesarCobroDelivery} disabled={cobrandoDelivery}>
            {cobrandoDelivery ? 'Procesando...' : `Cobrar $${cobroDeliveryPedido.total.toLocaleString('es-CL')}`}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
