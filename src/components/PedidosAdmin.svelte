<script lang="ts">
  import { onMount } from 'svelte';
  import { type Pedido, type DetallePedido } from '../lib/types';
  import { fetchTimeout } from '../lib/fetch-utils';

  let pedidos: (Pedido & { detalles?: DetallePedido[] })[] = $state([]);
  let loading: boolean = $state(true);
  let filterEstado: string = $state('hoy');
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let selectedPedido: (Pedido & { detalles?: DetallePedido[] }) | null = $state(null);
  let showPaymentModal: boolean = $state(false);
  let metodoPago: string = $state('efectivo');
  let efectivoConCuanto: number = $state(0);
  let cajaActiva: any | null = $state(null);
  let totalHoy: number = $state(0);
  let pagoError: string = $state('');
  let procesandoPago: boolean = $state(false);
  let clientesCredito: any[] = $state([]);
  let clienteCreditoId: number | null = $state(null);
  let loadSeq = 0;
  let loadingInFlight = false;

  const hoy = new Date().toISOString().split('T')[0];

  onMount(async () => {
    await loadInfo();
    await loadPedidos();
    pollingInterval = setInterval(() => {
      if (document.visibilityState === 'visible') loadPedidos();
    }, 20000);
    return () => { if (pollingInterval) clearInterval(pollingInterval); };
  });

  async function loadInfo() {
    try {
      const cRes = await fetch('/api/admin/cajas?activa=1');
      const cData = await cRes.json();
      cajaActiva = cData.cajas?.[0] || null;
    } catch (e) { /* ignore */ }
  }

  async function loadPedidos() {
    if (loadingInFlight) return;
    loadingInFlight = true;
    const seq = ++loadSeq;
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
      // Ignorar respuestas viejas si el filtro cambió mientras tanto
      if (seq !== loadSeq) return;
      pedidos = data.pedidos || [];

      if (filterEstado === 'hoy') {
        totalHoy = (data.pedidos || []).reduce((s: number, p: any) => s + (p.estado !== 'cancelado' ? p.total : 0), 0);
      } else {
        const params = new URLSearchParams({ desde: hoy });
        const hoyRes = await fetch('/api/admin/pedidos?' + params.toString());
        const hoyData = await hoyRes.json();
        if (seq !== loadSeq) return;
        totalHoy = (hoyData.pedidos || []).reduce((s: number, p: any) => s + (p.estado !== 'cancelado' ? p.total : 0), 0);
      }
    } catch (e) {
      console.error('Error:', e);
    } finally {
      if (seq === loadSeq) loading = false;
      loadingInFlight = false;
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
    metodoPago = 'efectivo';
    efectivoConCuanto = pedido.total || 0;
    pagoError = '';
    clienteCreditoId = null;
    cargarDetalles(pedido).then(() => { showPaymentModal = true; });
  }

  async function onMetodoChange(metodo: string) {
    metodoPago = metodo;
    pagoError = '';
    if (metodo === 'a_credito' && clientesCredito.length === 0) {
      try {
        const res = await fetch('/api/admin/clientes');
        const data = await res.json();
        clientesCredito = (data.clientes || []).filter((c: any) => c.activo);
      } catch {
        pagoError = 'No se pudieron cargar los clientes de crédito';
      }
    }
  }

  async function procesarPago() {
    if (!selectedPedido || procesandoPago) return;
    pagoError = '';

    // Validación local: efectivo debe cubrir el total
    if (metodoPago === 'efectivo' && efectivoConCuanto < selectedPedido.total) {
      pagoError = `El efectivo recibido ($${efectivoConCuanto.toLocaleString('es-CL')}) es menor al total ($${selectedPedido.total.toLocaleString('es-CL')})`;
      return;
    }
    if (metodoPago === 'a_credito' && !clienteCreditoId) {
      pagoError = 'Selecciona un cliente para el pago a crédito';
      return;
    }

    procesandoPago = true;
    try {
      const res = await fetchTimeout('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pedido_id: selectedPedido.id,
          metodo_pago: metodoPago,
          efectivo_con_cuanto: metodoPago === 'efectivo' ? efectivoConCuanto : 0,
          cliente_credito_id: metodoPago === 'a_credito' ? clienteCreditoId : null,
        }),
      }, 15000);
      const data = await res.json();
      if (!res.ok) {
        pagoError = data.error || 'Error al procesar el pago';
        return;
      }
      showPaymentModal = false;
      if (data.voucher) {
        window.open(`/admin/voucher?pedido_id=${data.voucher.pedido_id}`, '_blank');
      }
      loadPedidos();
    } catch (e: any) {
      pagoError = e?.message || 'Error de conexión. Verifica si el pago se aplicó antes de reintentar.';
    } finally {
      procesandoPago = false;
    }
  }

  function formatCLP(n: number): string { return '$' + n.toLocaleString('es-CL'); }

  function getTipoIcon(tipo: string) {
    if (tipo === 'delivery') return 'delivery';
    if (tipo === 'retiro') return 'retiro';
    return 'mesa';
  }
</script>

<div class="pedidos-page">
  <!-- Header -->
  <header class="pedidos-header">
    <div class="header-left">
      <div class="header-brand">
        <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>
        </svg>
        <div>
          <h1 class="header-title">Pedidos</h1>
          <p class="header-subtitle">Gestion de pedidos</p>
        </div>
      </div>
    </div>
    <div class="header-right">
      {#if cajaActiva}
        <div class="header-caja">
          <span class="caja-label">Caja</span>
          <span class="caja-value">#{cajaActiva.id} ({formatCLP(cajaActiva.efectivo_inicial)})</span>
        </div>
      {/if}
      <div class="header-total">
        <span class="total-label">Total hoy</span>
        <span class="total-value">{formatCLP(totalHoy)}</span>
      </div>
    </div>
  </header>

  <!-- Filters -->
  <div class="filters">
    {#each [
      { key: 'hoy', label: 'Hoy' },
      { key: '', label: 'Todos' },
      { key: 'pendiente', label: 'Pendientes' },
      { key: 'en_preparacion', label: 'Preparando' },
      { key: 'entregado', label: 'Entregados' },
      { key: 'pagado', label: 'Pagados' },
    ] as f}
      <button class="filter-btn" class:filter-active={filterEstado === f.key} onclick={() => { filterEstado = f.key; onFilterChange(); }}>
        {f.label}
      </button>
    {/each}
  </div>

  <!-- Content -->
  <div class="pedidos-content">
    {#if loading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Cargando pedidos...</p>
      </div>
    {:else if pedidos.length === 0}
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/>
        </svg>
        <p class="empty-title">Sin pedidos {filterEstado === 'hoy' ? 'hoy' : ''}</p>
      </div>
    {:else}
      <div class="pedidos-list">
        {#each pedidos as pedido (pedido.id)}
          {@const tipo = getTipoIcon(pedido.tipo_pedido)}
          <div class="pedido-card" class:card-delivery={tipo === 'delivery'} class:card-retiro={tipo === 'retiro'} class:card-mesa={tipo === 'mesa'}>
            <div class="pedido-main">
              <!-- Left: Info -->
              <div class="pedido-info">
                <div class="pedido-head">
                  <span class="pedido-id">#{pedido.id}</span>
                  <span class="pedido-badge" class:badge-pendiente={pedido.estado === 'pendiente'} class:badge-preparacion={pedido.estado === 'en_preparacion'} class:badge-entregado={pedido.estado === 'entregado'} class:badge-pagado={pedido.estado === 'pagado'} class:badge-cancelado={pedido.estado === 'cancelado'}>
                    {pedido.estado.replace(/_/g, ' ')}
                  </span>
                  {#if pedido.metodo_pago}
                    <span class="pedido-pago">{pedido.metodo_pago}</span>
                  {/if}
                </div>
                <div class="pedido-detail">
                  {#if pedido.tipo_pedido === 'mesa' && pedido.mesa_numero}
                    <span class="detail-mesa">Piso {pedido.mesa_piso} &middot; Mesa {pedido.mesa_numero}</span>
                    {#if pedido.tomada_por}
                      <span class="detail-person detail-garzon">{pedido.tomada_por}</span>
                    {:else if pedido.nombre_cliente}
                      <span class="detail-person detail-client">{pedido.nombre_cliente}</span>
                    {:else}
                      <span class="detail-person detail-auto">Autoservicio</span>
                    {/if}
                  {:else if pedido.tipo_pedido === 'delivery'}
                    <span class="detail-mesa">Delivery &middot; {pedido.nombre_cliente || 'Cliente'}</span>
                    {#if pedido.direccion}
                      <span class="detail-extra">{pedido.direccion}</span>
                    {/if}
                    {#if pedido.telefono}
                      <span class="detail-extra">{pedido.telefono}</span>
                    {/if}
                  {:else}
                    <span class="detail-mesa">{pedido.tipo_pedido}</span>
                  {/if}
                  <span class="detail-date">{new Date(pedido.fecha_hora).toLocaleString('es-CL')}</span>
                </div>
              </div>

              <!-- Right: Total + Actions -->
              <div class="pedido-right">
                <span class="pedido-total">{formatCLP(pedido.total)}</span>
                <div class="pedido-actions">
                  {#if pedido.estado === 'pendiente'}
                    <button class="action-btn action-prep" onclick={() => cambiarEstado(pedido, 'en_preparacion')}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z"/></svg>
                      Preparar
                    </button>
                  {:else if pedido.estado === 'en_preparacion'}
                    <button class="action-btn action-done" onclick={() => cambiarEstado(pedido, 'entregado')}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      Entregar
                    </button>
                  {:else if pedido.estado === 'entregado' && !pedido.metodo_pago}
                    <button class="action-btn action-cobrar" onclick={() => openPayment(pedido)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      Cobrar
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Payment Modal -->
{#if showPaymentModal && selectedPedido}
  <div class="modal-overlay" role="dialog" onclick={() => { showPaymentModal = false }}>
    <div class="modal-backdrop"></div>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h3 class="modal-title">Cobrar Pedido #{selectedPedido.id}</h3>
        <button class="modal-close" onclick={() => { showPaymentModal = false }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Order summary -->
      <div class="modal-summary">
        <p class="summary-label">Total a cobrar</p>
        <p class="summary-total">{formatCLP(selectedPedido.total)}</p>
        {#if selectedPedido.tipo_pedido === 'delivery'}
          <p class="summary-detail">Delivery &middot; {selectedPedido.nombre_cliente || 'Cliente'}</p>
          {#if selectedPedido.direccion}<p class="summary-extra">{selectedPedido.direccion}</p>{/if}
        {:else if selectedPedido.mesa_numero}
          <p class="summary-detail">Piso {selectedPedido.mesa_piso} &middot; Mesa {selectedPedido.mesa_numero}</p>
        {/if}
        {#if selectedPedido.detalles && selectedPedido.detalles.length > 0}
          <div class="summary-items">
            {#each selectedPedido.detalles as d}
              <div class="summary-item">
                <span>{d.cantidad}x {d.producto_nombre || '#' + d.producto_id}</span>
                <span>${(d.subtotal || 0).toLocaleString('es-CL')}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Payment method -->
      <div class="modal-field">
        <label class="field-label">Metodo de pago</label>
        <div class="metodo-grid">
          {#each ['efectivo', 'debito', 'credito', 'a_credito'] as metodo}
            <button class="metodo-btn" class:metodo-active={metodoPago === metodo} onclick={() => onMetodoChange(metodo)}>
              {metodo.replace('_', ' ')}
            </button>
          {/each}
        </div>
      </div>

      {#if metodoPago === 'a_credito'}
        <div class="modal-field">
          <label class="field-label">Cliente de credito</label>
          <select class="modal-input" bind:value={clienteCreditoId}>
            <option value={null}>Seleccionar cliente...</option>
            {#each clientesCredito as c}
              <option value={c.id}>{c.nombre} — disponible: ${(c.limite_credito - c.saldo_deudor).toLocaleString('es-CL')}</option>
            {/each}
          </select>
        </div>
      {/if}

      {#if metodoPago === 'efectivo'}
        <div class="modal-field">
          <label class="field-label">Con cuanto paga</label>
          <input type="number" bind:value={efectivoConCuanto} min={selectedPedido.total} class="modal-input" />
          {#if efectivoConCuanto > selectedPedido.total}
            <p class="vuelto">Vuelto: {formatCLP(efectivoConCuanto - selectedPedido.total)}</p>
          {/if}
          {#if efectivoConCuanto > 0 && efectivoConCuanto < selectedPedido.total}
            <p class="monto-insuficiente">El monto es menor al total</p>
          {/if}
        </div>
      {/if}

      {#if pagoError}
        <div class="pago-error">{pagoError}</div>
      {/if}

      <div class="modal-actions">
        <button class="modal-btn btn-cancel" disabled={procesandoPago} onclick={() => { showPaymentModal = false }}>Cancelar</button>
        <button class="modal-btn btn-cobrar" disabled={procesandoPago || (metodoPago === 'efectivo' && efectivoConCuanto < selectedPedido.total) || (metodoPago === 'a_credito' && !clienteCreditoId)} onclick={procesarPago}>
          {procesandoPago ? 'Procesando...' : `Cobrar ${formatCLP(selectedPedido.total)}`}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .pedidos-page {
    min-height: 100vh;
    background: var(--admin-bg);
    color: var(--admin-text);
    font-family: var(--font-body);
  }

  /* Header */
  .pedidos-header {
    background: var(--admin-surface);
    border-bottom: 1px solid var(--admin-border);
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
  }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .header-brand { display: flex; align-items: center; gap: 14px; }
  .header-icon { width: 28px; height: 28px; color: var(--admin-gold); }
  .header-title { font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; color: var(--admin-text); margin: 0; }
  .header-subtitle { font-size: 0.625rem; color: var(--admin-text-dim); text-transform: uppercase; letter-spacing: 0.08em; margin: 2px 0 0; }
  .header-right { display: flex; align-items: center; gap: 20px; }
  .header-caja { display: flex; flex-direction: column; gap: 2px; }
  .caja-label { font-size: 0.5625rem; color: var(--admin-text-dim); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }
  .caja-value { font-size: 0.8125rem; color: var(--admin-text-muted); font-weight: 500; }
  .header-total { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .total-label { font-size: 0.5625rem; color: var(--admin-text-dim); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }
  .total-value { font-size: 1.25rem; font-weight: 800; color: var(--admin-gold); }

  /* Filters */
  .filters {
    display: flex;
    gap: 6px;
    padding: 16px 24px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--admin-border);
    background: var(--admin-surface);
  }
  .filter-btn {
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid var(--admin-border);
    background: transparent;
    color: var(--admin-text-dim);
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  .filter-btn:hover { background: rgba(255,255,255,0.03); color: var(--admin-text-muted); }
  .filter-active {
    background: var(--admin-gold-dim);
    border-color: rgba(201,169,110,0.2);
    color: var(--admin-gold);
    font-weight: 600;
  }

  /* Content */
  .pedidos-content { padding: 24px; }

  .loading-state { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 80px 0; color: var(--admin-text-dim); }
  .loading-spinner { width: 32px; height: 32px; border: 3px solid var(--admin-border); border-top-color: var(--admin-gold); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 0; }
  .empty-icon { width: 56px; height: 56px; color: var(--admin-text-dim); opacity: 0.5; }
  .empty-title { font-size: 1rem; color: var(--admin-text-dim); margin: 0; }

  /* List */
  .pedidos-list { display: flex; flex-direction: column; gap: 8px; }

  .pedido-card {
    background: var(--admin-surface);
    border: 1px solid var(--admin-border);
    border-radius: 14px;
    padding: 16px 20px;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .pedido-card:hover { border-color: var(--admin-border-hover); box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
  .card-delivery { border-left: 3px solid #f97316; }
  .card-retiro { border-left: 3px solid #60a5fa; }
  .card-mesa { border-left: 3px solid #10b981; }

  .pedido-main { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .pedido-info { flex: 1; min-width: 0; }
  .pedido-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
  .pedido-id { font-size: 1rem; font-weight: 800; color: var(--admin-text); font-variant-numeric: tabular-nums; }

  .pedido-badge {
    display: inline-flex;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .badge-pendiente { background: rgba(201,169,110,0.12); color: var(--admin-gold); }
  .badge-preparacion { background: rgba(96,165,250,0.12); color: #60a5fa; }
  .badge-entregado { background: rgba(16,185,129,0.12); color: #10b981; }
  .badge-pagado { background: rgba(148,163,184,0.08); color: var(--admin-text-dim); }
  .badge-cancelado { background: rgba(239,68,68,0.1); color: #f87171; }

  .pedido-pago { font-size: 0.6875rem; color: var(--admin-text-dim); }

  .pedido-detail { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
  .detail-mesa { font-size: 0.8125rem; color: var(--admin-text-muted); font-weight: 500; }
  .detail-person { font-size: 0.75rem; font-weight: 600; }
  .detail-garzon { color: #c084fc; }
  .detail-client { color: var(--admin-text-muted); }
  .detail-auto { color: #34d399; }
  .detail-extra { font-size: 0.6875rem; color: var(--admin-text-dim); }
  .detail-date { font-size: 0.6875rem; color: var(--admin-text-dim); }

  .pedido-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .pedido-total { font-size: 1.0625rem; font-weight: 800; color: var(--admin-gold); }

  .pedido-actions { display: flex; gap: 6px; }
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
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
  .action-prep { background: linear-gradient(135deg, var(--admin-gold), #b8942e); color: #0a0a0f; }
  .action-prep:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(201,169,110,0.3); }
  .action-done { background: linear-gradient(135deg, #10b981, #059669); color: #fff; }
  .action-done:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
  .action-cobrar { background: linear-gradient(135deg, #f59e0b, #d97706); color: #0a0a0f; }
  .action-cobrar:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(245,158,11,0.3); }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px);
  }
  .modal-content {
    position: relative;
    z-index: 10;
    background: var(--admin-surface);
    border: 1px solid var(--admin-border);
    border-radius: 18px;
    width: 100%;
    max-width: 440px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 28px;
  }
  .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .modal-title { font-family: var(--font-display); font-size: 1.125rem; font-weight: 700; color: var(--admin-text); margin: 0; }
  .modal-close { width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent; color: var(--admin-text-dim); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
  .modal-close:hover { background: rgba(255,255,255,0.05); color: var(--admin-text); }
  .modal-close svg { width: 18px; height: 18px; }

  .modal-summary { background: rgba(0,0,0,0.2); border-radius: 12px; padding: 16px; margin-bottom: 20px; }
  .summary-label { font-size: 0.6875rem; color: var(--admin-text-dim); text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 4px; }
  .summary-total { font-size: 2rem; font-weight: 800; color: var(--admin-gold); margin: 0 0 4px; }
  .summary-detail { font-size: 0.8125rem; color: var(--admin-text-muted); margin: 0; }
  .summary-extra { font-size: 0.75rem; color: var(--admin-text-dim); margin: 4px 0 0; }
  .summary-items { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--admin-border); display: flex; flex-direction: column; gap: 4px; }
  .summary-item { display: flex; justify-content: space-between; font-size: 0.8125rem; color: var(--admin-text-muted); }

  .modal-field { margin-bottom: 16px; }
  .field-label { display: block; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--admin-gold); margin-bottom: 8px; }
  .metodo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .metodo-btn {
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid var(--admin-border);
    background: transparent;
    color: var(--admin-text-muted);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: capitalize;
  }
  .metodo-btn:hover { background: rgba(255,255,255,0.03); }
  .metodo-active { background: var(--admin-gold-dim); border-color: rgba(201,169,110,0.3); color: var(--admin-gold); font-weight: 600; }

  .modal-input {
    width: 100%;
    background: rgba(0,0,0,0.3);
    border: 1px solid var(--admin-border);
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 0.9375rem;
    font-family: var(--font-body);
    color: var(--admin-text);
    outline: none;
    transition: border-color 0.2s;
  }
  .modal-input:focus { border-color: var(--admin-gold); }
  .vuelto { font-size: 0.875rem; font-weight: 600; color: var(--admin-emerald); margin: 8px 0 0; }
  .monto-insuficiente { font-size: 0.8125rem; font-weight: 600; color: #f87171; margin: 8px 0 0; }
  .pago-error {
    padding: 12px 16px;
    border-radius: 10px;
    background: var(--admin-error-dim);
    border: 1px solid rgba(196, 60, 60, 0.2);
    color: #fca5a5;
    font-size: 0.8125rem;
    margin-bottom: 4px;
  }

  .modal-actions { display: flex; gap: 10px; margin-top: 24px; }
  .modal-btn {
    flex: 1;
    padding: 12px 20px;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 0.875rem;
    font-weight: 700;
    transition: all 0.2s;
  }
  .modal-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; box-shadow: none !important; }
  .btn-cancel { background: var(--admin-surface-2); color: var(--admin-text-muted); border: 1px solid var(--admin-border); }
  .btn-cancel:hover { background: var(--admin-surface-3); color: var(--admin-text); }
  .btn-cobrar { background: linear-gradient(135deg, var(--admin-gold), #b8942e); color: #0a0a0f; }
  .btn-cobrar:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(201,169,110,0.3); }
</style>
