<script lang="ts">
  import { onMount } from 'svelte';
  import type { Pedido, DetallePedido } from '../lib/types';
  import { fetchTimeout } from '../lib/fetch-utils';

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
  let autoPrint: boolean = $state(false);
  let prevIds: Set<number> = new Set();
  let nuevosIds: Set<number> = $state(new Set<number>());

  let highlightTimeout: ReturnType<typeof setTimeout> | null = null;
  let loadingInFlight = false;

  onMount(async () => {
    await loadPedidos();
    pollingInterval = setInterval(() => {
      if (document.visibilityState === 'visible') loadPedidos();
    }, 30000);
    timerInterval = setInterval(() => { now = new Date(); }, 5000);
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
      if (timerInterval) clearInterval(timerInterval);
      if (highlightTimeout) clearTimeout(highlightTimeout);
    };
  });

  async function loadPedidos() {
    if (loadingInFlight) return;
    loadingInFlight = true;
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

      const esPrimeraCarga = prevIds.size === 0;

      if (recienLlegados.size > 0 && !esPrimeraCarga && soundEnabled) {
        playNewOrderSound();
      }

      prevIds = idsActuales;
      nuevosIds = recienLlegados;
      pedidos = pedidosConDetalles;

      // Auto-imprimir comanda de los pedidos recién llegados
      if (recienLlegados.size > 0 && !esPrimeraCarga && autoPrint) {
        for (const p of pedidosConDetalles) {
          if (recienLlegados.has(p.id)) imprimirComanda(p);
        }
      }

      if (highlightTimeout) clearTimeout(highlightTimeout);
      highlightTimeout = setTimeout(() => { nuevosIds = new Set(); }, 3000);
    } catch (e) {
      console.error('Error:', e);
    } finally {
      loading = false;
      loadingInFlight = false;
    }
  }

  // AudioContext reutilizable: crear uno solo evita el límite de ~6 contextos del navegador
  let audioCtx: AudioContext | null = null;

  function playNewOrderSound() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      [880, 1100].forEach((freq, i) => {
        setTimeout(() => {
          if (!audioCtx) return;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain); gain.connect(audioCtx.destination);
          osc.frequency.value = freq; gain.gain.value = 0.12;
          osc.start(); osc.stop(audioCtx.currentTime + 0.15);
        }, i * 180);
      });
    } catch (e) { /* no soportado */ }
  }

  function getTipoPedido(p: PedidoExt): 'delivery' | 'garzon' | 'autoservicio' {
    if (p.tipo_pedido === 'delivery') return 'delivery';
    if (p.tomada_por) return 'garzon';
    return 'autoservicio';
  }

  async function avanzarEstado(pedidoId: number, nuevoEstado: string) {
    try {
      const res = await fetchTimeout('/api/admin/pedidos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pedidoId, estado: nuevoEstado }),
      }, 10000);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'No se pudo actualizar el pedido');
      }
      loadPedidos();
    } catch (e: any) {
      alert(e?.message || 'Error de conexión');
    }
  }

  function getMinutosDesde(fecha: string): number {
    return Math.max(0, Math.floor((now.getTime() - new Date(fecha).getTime()) / 60000));
  }

  function getSegundosDesde(fecha: string): number {
    return Math.max(0, Math.floor((now.getTime() - new Date(fecha).getTime()) / 1000));
  }

  function formatCLP(n: number): string { return '$' + n.toLocaleString('es-CL'); }

  function countByEstado(estado: string): number {
    return pedidos.filter(p => p.estado === estado).length;
  }

  function esc(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Imprime vía iframe oculto: evita el bloqueo de popups del navegador
  function printHtml(html: string) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const win = iframe.contentWindow;
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.onload = () => {
      win.focus();
      win.print();
      setTimeout(() => iframe.remove(), 60000);
    };
  }

  function imprimirComanda(p: PedidoExt) {
    const tipo = getTipoPedido(p);
    const donde = tipo === 'delivery'
      ? `DELIVERY - ${p.nombre_cliente || 'Cliente'}`
      : p.mesa_piso === 3
      ? `PUB - Silla ${p.mesa_numero}`
      : `Piso ${p.mesa_piso} - Mesa ${p.mesa_numero}`;
    const items = (p.detalles || []).map(d => {
      const acomp = d.acompanamiento && d.acompanamiento !== 'Sin acompanamiento' ? `<div class="side">+ ${esc(d.acompanamiento)}</div>` : '';
      return `<div class="item"><span class="qty">${d.cantidad}x</span> ${esc(d.producto_nombre || '#' + d.producto_id)}</div>${acomp}`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Comanda #${p.id}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:11px;padding:6px 8px;max-width:72mm;color:#000}
  .center{text-align:center}.bold{font-weight:bold}.divider{border-top:1px dashed #000;margin:5px 0}
  .item{font-size:13px;margin:2px 0}.qty{font-weight:bold}
  .side{font-size:10px;color:#333;margin-left:26px}
  .comment{font-size:10px;font-style:italic;margin-top:4px;border-top:1px dashed #000;padding-top:4px}
</style></head><body>
<div class="center bold" style="font-size:14px">COMANDA COCINA</div>
<div class="center" style="font-size:10px">La Cascada</div>
<div class="divider"></div>
<div class="bold" style="font-size:13px">PEDIDO #${p.id}</div>
<div>${esc(donde)}</div>
<div>${new Date(p.fecha_hora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}${p.tomada_por ? ' · ' + esc(p.tomada_por) : ''}</div>
<div class="divider"></div>
${items}
${p.comentarios ? `<div class="comment">Nota: ${esc(p.comentarios)}</div>` : ''}
<div class="divider"></div>
</body></html>`;
    printHtml(html);
  }
</script>

<div class="kitchen">
  <!-- Header -->
  <header class="kitchen-header">
    <div class="header-left">
      <div class="header-brand">
        <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"/>
          <path d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z"/>
        </svg>
        <div>
          <h1 class="header-title">Cocina</h1>
          <p class="header-subtitle">Panel de produccion</p>
        </div>
      </div>
      <div class="header-clock">
        <span class="clock-dot"></span>
        <span class="clock-time">{now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>

    <div class="header-stats">
      <div class="header-stat">
        <span class="stat-num stat-pending">{countByEstado('pendiente')}</span>
        <span class="stat-label">Pendientes</span>
      </div>
      <div class="header-stat">
        <span class="stat-num stat-cooking">{countByEstado('en_preparacion')}</span>
        <span class="stat-label">Preparando</span>
      </div>
      <button class="sound-btn" class:sound-on={autoPrint} title={autoPrint ? 'Auto-imprimir comandas: activado' : 'Auto-imprimir comandas: desactivado'} onclick={() => { autoPrint = !autoPrint }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
        {#if autoPrint}<span class="auto-badge">AUTO</span>{/if}
      </button>
      <button class="sound-btn" class:sound-on={soundEnabled} onclick={() => { soundEnabled = !soundEnabled }}>
        {#if soundEnabled}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"/></svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"/></svg>
        {/if}
      </button>
    </div>
  </header>

  <!-- Content -->
  <div class="kitchen-content">
    {#if loading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Cargando pedidos...</p>
      </div>
    {:else if pedidos.length === 0}
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="empty-title">Sin pedidos activos</p>
        <p class="empty-sub">Los nuevos pedidos apareceran aqui automaticamente</p>
      </div>
    {:else}
      <!-- Legend -->
      <div class="legend">
        <span class="legend-item"><span class="legend-dot" style="background: #f97316;"></span> Delivery</span>
        <span class="legend-item"><span class="legend-dot" style="background: #a855f7;"></span> Garzon</span>
        <span class="legend-item"><span class="legend-dot" style="background: #10b981;"></span> Autoservicio</span>
        <span class="legend-item"><span class="legend-dot pulse-red"></span> Urgente (+10 min)</span>
      </div>

      <!-- Tickets grid -->
      <div class="tickets-grid">
        {#each pedidos as pedido (pedido.id)}
          {@const tipo = getTipoPedido(pedido)}
          {@const minutos = getMinutosDesde(pedido.fecha_hora)}
          {@const segundos = getSegundosDesde(pedido.fecha_hora)}
          {@const esNuevo = nuevosIds.has(pedido.id)}
          {@const urgente = minutos >= 10 && pedido.estado === 'pendiente'}

          <div class="ticket" class:ticket-delivery={tipo === 'delivery'} class:ticket-garzon={tipo === 'garzon'} class:ticket-auto={tipo === 'autoservicio'} class:ticket-new={esNuevo} class:ticket-urgent={urgente}>
            <!-- Ticket header -->
            <div class="ticket-head">
              <div class="ticket-id-section">
                <span class="ticket-id">#{pedido.id}</span>
                <span class="ticket-type-badge" class:badge-delivery={tipo === 'delivery'} class:badge-garzon={tipo === 'garzon'} class:badge-auto={tipo === 'autoservicio'}>
                  {#if tipo === 'delivery'}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"/></svg>
                    DELIVERY
                  {:else if tipo === 'garzon'}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
                    GARZON
                  {:else}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5"/></svg>
                    AUTOSERVICIO
                  {/if}
                </span>
              </div>
              <div class="ticket-time">
                {#if segundos < 60}
                  <span class="time-new">NUEVO</span>
                {:else}
                  <span class="time-value" class:time-urgent={urgente}>{minutos}m</span>
                {/if}
              </div>
            </div>

            <!-- Table / Delivery info -->
            {#if tipo === 'delivery'}
              <div class="ticket-info info-delivery">
                <p class="info-label">Cliente</p>
                <p class="info-value">{pedido.nombre_cliente || 'Cliente'}</p>
                {#if pedido.direccion}<p class="info-detail">{pedido.direccion}</p>{/if}
                {#if pedido.telefono}<p class="info-detail">{pedido.telefono}</p>{/if}
              </div>
            {:else if pedido.mesa_numero}
              <div class="ticket-info" class:info-garzon={tipo === 'garzon'} class:info-auto={tipo === 'autoservicio'}>
                <p class="info-type">{tipo === 'garzon' ? 'Atendido por garzon' : 'Autoservicio'}</p>
                <div class="table-display">
                  <div class="table-num">
                    <span class="table-label">{pedido.mesa_piso === 3 ? 'Zona' : 'Piso'}</span>
                    <span class="table-value">{pedido.mesa_piso === 3 ? 'PUB' : pedido.mesa_piso}</span>
                  </div>
                  <span class="table-dot">·</span>
                  <div class="table-num">
                    <span class="table-label">{pedido.mesa_piso === 3 ? 'Silla' : 'Mesa'}</span>
                    <span class="table-value table-value-big">{pedido.mesa_numero}</span>
                  </div>
                </div>
                {#if pedido.tomada_por}
                  <p class="info-person">{pedido.tomada_por}</p>
                {:else if pedido.nombre_cliente}
                  <p class="info-person">{pedido.nombre_cliente}</p>
                  {#if pedido.tipo_pedido === 'reserva' && pedido.direccion?.includes('Reserva - ')}
                    {@const hora = pedido.direccion.replace('Reserva - ', '')}
                    <p class="info-reserva">Listo antes de las {hora}</p>
                  {/if}
                {/if}
              </div>
            {/if}

            <!-- Items -->
            <div class="ticket-items">
              {#each pedido.detalles || [] as d (d.id)}
                <div class="ticket-item">
                  <span class="item-qty">{d.cantidad}x</span>
                  <span class="item-name">{d.producto_nombre || '#' + d.producto_id}</span>
                </div>
                {#if d.acompanamiento && d.acompanamiento !== 'Sin acompanamiento'}
                  <p class="item-side">{d.acompanamiento}</p>
                {/if}
              {/each}
              {#if !pedido.detalles || pedido.detalles.length === 0}
                <p class="item-loading">Cargando items...</p>
              {/if}
              {#if pedido.comentarios}
                <div class="ticket-comment">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>
                  <span>{pedido.comentarios}</span>
                </div>
              {/if}
            </div>

            <!-- Footer -->
            <div class="ticket-footer">
              <span class="ticket-total">{formatCLP(pedido.total)}</span>
              <div class="ticket-actions">
                {#if pedido.estado === 'pendiente'}
                  <button class="action-btn action-prep" onclick={() => avanzarEstado(pedido.id, 'en_preparacion')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"/></svg>
                    PREPARAR
                  </button>
                {:else if pedido.estado === 'en_preparacion'}
                  <button class="action-btn action-done" onclick={() => avanzarEstado(pedido.id, 'entregado')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    LISTO
                  </button>
                {/if}
                <button class="action-btn action-print" title="Imprimir comanda" onclick={() => imprimirComanda(pedido)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                </button>
                <button class="action-btn action-cancel" onclick={() => avanzarEstado(pedido.id, 'cancelado')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
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
  .kitchen {
    min-height: 100vh;
    background: var(--admin-bg);
    color: var(--admin-text);
    font-family: var(--font-body);
  }

  /* Header */
  .kitchen-header {
    background: var(--admin-surface);
    border-bottom: 1px solid var(--admin-border);
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    position: sticky;
    top: 0;
    z-index: 20;
    backdrop-filter: blur(12px);
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 24px;
  }
  .header-brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .header-icon {
    width: 32px;
    height: 32px;
    color: var(--admin-gold);
  }
  .header-title {
    font-family: var(--font-display);
    font-size: 1.375rem;
    font-weight: 700;
    color: var(--admin-text);
    margin: 0;
    line-height: 1.2;
  }
  .header-subtitle {
    font-size: 0.6875rem;
    color: var(--admin-text-dim);
    margin: 2px 0 0;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .header-clock {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .clock-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--admin-emerald);
    animation: pulse-dot 2s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(45, 138, 94, 0.4); }
    50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(45, 138, 94, 0); }
  }
  .clock-time {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--admin-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .header-stats {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .header-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .stat-num {
    font-size: 1.5rem;
    font-weight: 800;
    line-height: 1;
  }
  .stat-pending { color: var(--admin-gold); }
  .stat-cooking { color: #60a5fa; }
  .stat-label {
    font-size: 0.625rem;
    color: var(--admin-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
  }

  .sound-btn {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    border: 1px solid var(--admin-border);
    background: transparent;
    color: var(--admin-text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .sound-btn:hover {
    background: rgba(255,255,255,0.03);
    color: var(--admin-text);
  }
  .sound-btn.sound-on {
    border-color: rgba(45, 138, 94, 0.3);
    color: var(--admin-emerald);
  }
  .sound-btn svg { width: 20px; height: 20px; }

  /* Content */
  .kitchen-content {
    padding: 24px;
  }

  /* Loading */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 80px 0;
    color: var(--admin-text-dim);
  }
  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--admin-border);
    border-top-color: var(--admin-gold);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Empty */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 100px 0;
  }
  .empty-icon {
    width: 64px;
    height: 64px;
    color: var(--admin-emerald);
    opacity: 0.6;
  }
  .empty-title {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--admin-text-muted);
    margin: 0;
  }
  .empty-sub {
    font-size: 0.875rem;
    color: var(--admin-text-dim);
    margin: 0;
  }

  /* Legend */
  .legend {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: var(--admin-text-dim);
  }
  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 3px;
  }
  .pulse-red {
    background: #ef4444;
    animation: pulse-dot 1.5s ease-in-out infinite;
  }

  /* Tickets grid */
  .tickets-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 12px;
  }
  @media (min-width: 640px) { .tickets-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .tickets-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 1536px) { .tickets-grid { grid-template-columns: repeat(4, 1fr); } }

  /* Ticket */
  .ticket {
    background: var(--admin-surface);
    border: 1px solid var(--admin-border);
    border-radius: 14px;
    padding: 16px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .ticket:hover {
    border-color: var(--admin-border-hover);
    box-shadow: 0 4px 20px rgba(0,0,0,0.2);
  }
  .ticket-delivery { border-left: 3px solid #f97316; }
  .ticket-garzon { border-left: 3px solid #a855f7; }
  .ticket-auto { border-left: 3px solid #10b981; }

  .ticket-new {
    animation: ticket-enter 0.5s ease-out;
    box-shadow: 0 0 0 2px rgba(201,169,110,0.3), 0 4px 20px rgba(0,0,0,0.3);
  }
  @keyframes ticket-enter {
    0% { transform: scale(0.92); opacity: 0; }
    60% { transform: scale(1.02); opacity: 1; }
    100% { transform: scale(1); }
  }

  .ticket-urgent {
    border-color: rgba(239, 68, 68, 0.4) !important;
    background: linear-gradient(135deg, var(--admin-surface), rgba(239, 68, 68, 0.05));
  }

  /* Ticket header */
  .ticket-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }
  .ticket-id-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ticket-id {
    font-size: 1.125rem;
    font-weight: 800;
    color: var(--admin-text);
    font-variant-numeric: tabular-nums;
  }
  .ticket-type-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .ticket-type-badge svg { width: 12px; height: 12px; }
  .badge-delivery { background: rgba(249,115,22,0.15); color: #fb923c; }
  .badge-garzon { background: rgba(168,85,247,0.15); color: #c084fc; }
  .badge-auto { background: rgba(16,185,129,0.15); color: #34d399; }

  .ticket-time { text-align: right; }
  .time-new {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--admin-gold);
    animation: pulse-dot 1.5s ease-in-out infinite;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .time-value {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--admin-text-dim);
    font-variant-numeric: tabular-nums;
  }
  .time-urgent { color: #ef4444; font-weight: 700; }

  /* Ticket info */
  .ticket-info {
    padding: 12px;
    border-radius: 10px;
    background: rgba(0,0,0,0.2);
  }
  .info-delivery { border-left: 2px solid #f97316; }
  .info-garzon { border-left: 2px solid #a855f7; }
  .info-auto { border-left: 2px solid #10b981; }

  .info-label {
    font-size: 0.625rem;
    color: var(--admin-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    margin: 0 0 4px;
  }
  .info-value {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--admin-text);
    margin: 0;
  }
  .info-detail {
    font-size: 0.75rem;
    color: var(--admin-text-dim);
    margin: 4px 0 0;
  }
  .info-type {
    font-size: 0.625rem;
    color: var(--admin-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    text-align: center;
    margin: 0 0 8px;
  }
  .table-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  .table-num {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .table-label {
    font-size: 0.5625rem;
    color: var(--admin-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 600;
  }
  .table-value {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--admin-text);
    line-height: 1;
  }
  .table-value-big { font-size: 1.75rem; }
  .table-dot {
    font-size: 1.25rem;
    color: var(--admin-text-dim);
  }
  .info-person {
    text-align: center;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--admin-text-muted);
    margin: 8px 0 0;
  }
  .info-reserva {
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--admin-gold);
    margin: 6px 0 0;
  }

  /* Items */
  .ticket-items {
    background: rgba(0,0,0,0.15);
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }
  .ticket-item {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .item-qty {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--admin-gold);
    min-width: 24px;
  }
  .item-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--admin-text);
  }
  .item-side {
    font-size: 0.6875rem;
    color: var(--admin-text-dim);
    margin: 0 0 0 30px;
  }
  .item-loading {
    font-size: 0.75rem;
    color: var(--admin-text-dim);
    font-style: italic;
    margin: 0;
  }
  .ticket-comment {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--admin-border);
  }
  .ticket-comment svg {
    width: 14px;
    height: 14px;
    color: var(--admin-gold);
    flex-shrink: 0;
    margin-top: 1px;
  }
  .ticket-comment span {
    font-size: 0.6875rem;
    color: var(--admin-gold);
    font-style: italic;
  }

  /* Footer */
  .ticket-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 8px;
    border-top: 1px solid var(--admin-border);
  }
  .ticket-total {
    font-size: 0.9375rem;
    font-weight: 800;
    color: var(--admin-gold);
  }
  .ticket-actions {
    display: flex;
    gap: 6px;
  }
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 7px 12px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    transition: all 0.2s;
  }
  .action-btn svg { width: 14px; height: 14px; }
  .action-prep {
    background: linear-gradient(135deg, var(--admin-gold), #b8942e);
    color: #0a0a0f;
  }
  .action-prep:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(201,169,110,0.3); }
  .action-done {
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
  }
  .action-done:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
  .action-cancel {
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
    padding: 7px 8px;
  }
  .action-cancel:hover { background: rgba(239, 68, 68, 0.2); }
  .action-print {
    background: var(--admin-surface-2);
    color: var(--admin-text-muted);
    border: 1px solid var(--admin-border);
    padding: 7px 8px;
  }
  .action-print:hover { color: var(--admin-text); background: var(--admin-surface-3); }
  .auto-badge {
    font-size: 0.5rem;
    font-weight: 800;
    letter-spacing: 0.05em;
  }
</style>
