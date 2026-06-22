<script lang="ts">
  import { onMount } from 'svelte';
  import type { Pedido, DetallePedido } from '../lib/types';

  interface PedidoExt extends Pedido {
    detalles?: DetallePedido[];
    tomada_por?: string | null;
  }

  let pedidos: PedidoExt[] = $state([]);
  let loading: boolean = $state(true);
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let now: Date = $state(new Date());
  let timerInterval: ReturnType<typeof setInterval> | null = null;
  let soundEnabled: boolean = $state(true);
  let prevIds: Set<number> = new Set();
  let nuevosIds: Set<number> = $state(new Set<number>());

  onMount(async () => {
    await loadPedidos();
    pollingInterval = setInterval(loadPedidos, 30000);
    timerInterval = setInterval(() => { now = new Date(); }, 5000);
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
      if (timerInterval) clearInterval(timerInterval);
    };
  });

  async function loadPedidos() {
    try {
      const estados = ['pendiente', 'en_preparacion'];
      const params = new URLSearchParams();
      estados.forEach(e => params.append('estado', e));
      const res = await fetch('/api/admin/pedidos?' + params.toString());
      const data = await res.json();
      const nuevos = data.pedidos || [];

      const idsActuales = new Set(nuevos.map((p: any) => p.id));
      const recienLlegados = new Set([...idsActuales].filter(id => !prevIds.has(id)));

      const pedidosConDetalles = await Promise.all(
        nuevos.map(async (p: any) => {
          try {
            const detRes = await fetch(`/api/admin/pedidos/${p.id}/detalles`);
            const detData = await detRes.json();
            return { ...p, detalles: detData.detalles || [] };
          } catch (e) { return { ...p, detalles: [] }; }
        })
      );

      if (recienLlegados.size > 0 && prevIds.size > 0 && soundEnabled) {
        playNewOrderSound();
      }

      prevIds = idsActuales;
      nuevosIds = recienLlegados;
      pedidos = pedidosConDetalles;

      setTimeout(() => { nuevosIds = new Set(); }, 3000);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      loading = false;
    }
  }

  function playNewOrderSound() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      [880, 1100].forEach((freq, i) => {
        setTimeout(() => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain); gain.connect(audioCtx.destination);
          osc.frequency.value = freq; gain.gain.value = 0.12;
          osc.start(); osc.stop(audioCtx.currentTime + 0.15);
        }, i * 180);
      });
    } catch (e) { /* no soportado */ }
  }

  function getTipoTicket(p: PedidoExt): { icon: string; label: string; color: string } {
    if (p.tipo_pedido === 'delivery') return { icon: '🛵', label: 'DELIVERY', color: 'border-orange-400 bg-orange-900/20' };
    if (p.tomada_por) return { icon: '👤', label: 'GARZÓN', color: 'border-purple-400 bg-purple-900/20' };
    return { icon: '🍽️', label: 'AUTOSERVICIO', color: 'border-emerald-400 bg-emerald-900/20' };
  }

  async function avanzarEstado(pedidoId: number, nuevoEstado: string) {
    try {
      await fetch('/api/admin/pedidos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pedidoId, estado: nuevoEstado }) });
      loadPedidos();
    } catch (e) { console.error('Error:', e); }
  }

  function getMinutosDesde(fecha: string): number {
    return Math.max(0, Math.floor((now.getTime() - new Date(fecha).getTime()) / 60000));
  }

  function getSegundosDesde(fecha: string): number {
    return Math.max(0, Math.floor((now.getTime() - new Date(fecha).getTime()) / 1000));
  }

  function formatCLP(n: number): string { return '$' + n.toLocaleString('es-CL'); }

  function countBy(key: string, val: string): number {
    return pedidos.filter(p => {
      if (key === 'tipo') return getTipoTicket(p).label === val;
      return (p as any)[key] === val;
    }).length;
  }
</script>

<div class="min-h-screen bg-gray-950 text-white">
  <!-- Header -->
  <header class="bg-gray-900 border-b border-gray-800 px-4 py-3">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-extrabold tracking-tight text-white">👨‍🍳 COCINA</h1>
        <div class="flex items-center gap-2 text-xs text-gray-400">
          <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          {now.toLocaleTimeString('es-CL')}
        </div>
      </div>
      <div class="flex items-center gap-4 text-sm">
        <span class="text-yellow-400 font-bold">{countBy('estado', 'pendiente')} pendientes</span>
        <span class="text-blue-400 font-bold">{countBy('estado', 'en_preparacion')} preparando</span>
        <button class="px-3 py-1.5 rounded-lg text-xs {soundEnabled ? 'bg-green-700' : 'bg-gray-700'}" onclick={() => { soundEnabled = !soundEnabled }}>
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>
    </div>
  </header>

  <div class="p-4">
    {#if loading}
      <div class="text-center py-12 text-gray-600">Cargando...</div>
    {:else if pedidos.length === 0}
      <div class="text-center py-20 text-gray-700">
        <p class="text-5xl mb-3">✅</p>
        <p class="text-xl font-medium">Sin pedidos activos</p>
      </div>
    {:else}
      <!-- Leyenda -->
      <div class="flex gap-4 mb-4 text-xs flex-wrap">
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-orange-500"></span> Delivery</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-purple-500"></span> Garzón</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-emerald-500"></span> Autoservicio</span>
        <span class="flex items-center gap-1.5 text-gray-500"><span class="w-3 h-3 rounded bg-red-500 animate-pulse"></span> Urgente (+10 min)</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        {#each pedidos as pedido (pedido.id)}
          {@const tipo = getTipoTicket(pedido)}
          {@const minutos = getMinutosDesde(pedido.fecha_hora)}
          {@const segundos = getSegundosDesde(pedido.fecha_hora)}
          {@const esNuevo = nuevosIds.has(pedido.id)}
          {@const urgente = minutos >= 10 && pedido.estado === 'pendiente'}

          <div class="rounded-xl border-2 p-3 transition-all {tipo.color} {esNuevo ? 'animate-ticket-in scale-105 ring-2 ring-yellow-400/50' : ''} {urgente ? 'border-red-500 bg-red-950/40 ring-1 ring-red-500/30' : ''}">
            <!-- Cabecera del ticket -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5">
                <span class="text-xl">{tipo.icon}</span>
                <span class="font-bold text-lg">#{pedido.id}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider {tipo.label === 'DELIVERY' ? 'bg-orange-500/30 text-orange-300' : tipo.label === 'GARZÓN' ? 'bg-purple-500/30 text-purple-300' : 'bg-emerald-500/30 text-emerald-300'}">{tipo.label}</span>
              </div>
              <div class="text-right">
                {#if segundos < 60}
                  <span class="text-xs text-green-400 font-bold animate-pulse">NUEVO</span>
                {:else}
                  <span class="text-xs font-mono {urgente ? 'text-red-400 font-bold' : 'text-gray-500'}">{minutos}m</span>
                {/if}
              </div>
            </div>

            <!-- PISO Y MESA - bien grande -->
            {#if pedido.tipo_pedido === 'delivery'}
              <div class="mb-2 p-2 rounded-lg bg-black/20">
                <p class="text-xs text-orange-300/70 uppercase tracking-wider font-semibold">Delivery</p>
                <p class="text-base font-bold text-orange-200">{pedido.nombre_cliente || 'Cliente'}</p>
                {#if pedido.direccion}<p class="text-xs text-gray-400">📍 {pedido.direccion}</p>{/if}
                {#if pedido.telefono}<p class="text-xs text-gray-400">📞 {pedido.telefono}</p>{/if}
              </div>
            {:else if pedido.mesa_numero}
              <div class="mb-2 p-3 rounded-lg bg-black/20">
                <!-- Tipo -->
                <p class="text-[10px] uppercase tracking-widest font-bold text-center mb-1 {pedido.tomada_por ? 'text-purple-400/80' : 'text-emerald-400/80'}">
                  {pedido.tomada_por ? '👤 Garzón' : '🍽️ Autoservicio'}
                </p>
                <!-- Piso + Mesa en grande -->
                <div class="flex items-center justify-center gap-4 mb-1">
                  <div class="text-center">
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider">Piso</p>
                    <p class="text-2xl font-extrabold text-white leading-none">{pedido.mesa_piso}</p>
                  </div>
                  <span class="text-gray-600 text-xl">·</span>
                  <div class="text-center">
                    <p class="text-[10px] text-gray-500 uppercase tracking-wider">Mesa</p>
                    <p class="text-3xl font-extrabold text-white leading-none">{pedido.mesa_numero}</p>
                  </div>
                </div>
                <!-- Garzón bien visible -->
                {#if pedido.tomada_por}
                  <div class="flex items-center justify-center gap-1.5 mt-1">
                    <span class="text-lg">👤</span>
                    <span class="text-sm font-bold text-purple-300">{pedido.tomada_por}</span>
                  </div>
                {:else if pedido.nombre_cliente}
                  <div class="flex items-center justify-center gap-1.5 mt-1">
                    <span class="text-lg">🙋</span>
                    <span class="text-sm font-bold text-emerald-300">{pedido.nombre_cliente}</span>
                  </div>
                {/if}
              </div>
            {:else}
              <p class="text-sm text-gray-300 mb-2">{pedido.tipo_pedido}</p>
            {/if}

            <!-- Items -->
            <div class="bg-black/30 rounded-lg p-2 mb-2 space-y-1">
              {#each pedido.detalles || [] as d (d.id)}
                <div class="flex justify-between text-xs">
                  <span class="text-gray-200 font-medium">{d.cantidad}x {d.producto_nombre || '#' + d.producto_id}</span>
                </div>
                {#if d.acompanamiento && d.acompanamiento !== 'Sin acompañamiento'}
                  <p class="text-[10px] text-gray-500 ml-3">↳ {d.acompanamiento}</p>
                {/if}
              {/each}
              {#if !pedido.detalles || pedido.detalles.length === 0}
                <p class="text-xs text-gray-600">Cargando items...</p>
              {/if}
              {#if pedido.comentarios}
                <div class="border-t border-white/10 mt-1.5 pt-1.5">
                  <p class="text-[10px] text-yellow-400 italic">💬 {pedido.comentarios}</p>
                </div>
              {/if}
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between">
              <span class="font-extrabold text-brand-400 text-sm">{formatCLP(pedido.total)}</span>
              <div class="flex gap-1">
                {#if pedido.estado === 'pendiente'}
                  <button class="bg-brand-600 hover:bg-brand-500 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold transition-colors" onclick={() => avanzarEstado(pedido.id, 'en_preparacion')}>
                    PREPARAR
                  </button>
                {:else if pedido.estado === 'en_preparacion'}
                  <button class="bg-green-600 hover:bg-green-500 text-white text-xs px-2.5 py-1.5 rounded-lg font-bold transition-colors" onclick={() => avanzarEstado(pedido.id, 'entregado')}>
                    LISTO
                  </button>
                {/if}
                <button class="bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs px-2 py-1.5 rounded-lg font-medium transition-colors" onclick={() => avanzarEstado(pedido.id, 'cancelado')}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  @keyframes ticket-in {
    0% { transform: scale(0.9); opacity: 0; box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.6); }
    50% { transform: scale(1.02); opacity: 1; box-shadow: 0 0 20px 4px rgba(250, 204, 21, 0.3); }
    100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(250, 204, 21, 0); }
  }
  .animate-ticket-in {
    animation: ticket-in 0.6s ease-out;
  }
</style>
