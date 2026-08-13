<script lang="ts">
  import { onMount } from 'svelte';

  function esc(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  let activeTab: string = $state('ventas');
  let hoy: any[] = $state([]);
  let ultimos7dias: any[] = $state([]);
  let mensual: any[] = $state([]);
  let ventasPorCajera: any[] = $state([]);
  let topProductos: any[] = $state([]);
  let loading: boolean = $state(true);
  let mesSeleccionado: string = $state(new Date().toISOString().slice(0, 7));
  let totalesMes: any = $state(null);

  let detallePagos: any[] = $state([]);
  let filtroPagoMetodo: string = $state('');
  let loadingDetalles: boolean = $state(false);

  let deliveryHoy: any[] = $state([]);
  let delivery7dias: any[] = $state([]);
  let deliveryTop: any[] = $state([]);
  let loadingDelivery: boolean = $state(false);

  const tabs = [
    { id: 'ventas', label: 'Resumen de ventas', icon: '💰' },
    { id: 'detalles', label: 'Detalles de pago', icon: '🧾' },
    { id: 'delivery', label: 'Reportes delivery', icon: '🛵' },
  ];

  const chartColors = ['#16a34a', '#dc2626', '#2563eb', '#ca8a04', '#9333ea', '#0891b2', '#ea580c', '#4f46e5'];

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && tabs.some(t => t.id === tabParam)) activeTab = tabParam;
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const url = `/api/admin/reportes?mes=${mesSeleccionado}`;
      const res = await fetch(url);
      const data = await res.json();
      hoy = data.hoy || [];
      ultimos7dias = data.ultimos7dias || [];
      mensual = data.mensual || [];
      ventasPorCajera = data.ventasPorCajera || [];
      topProductos = data.topProductos || [];

      if (mensual.length > 0) {
        totalesMes = {
          ventas: mensual.reduce((s: number, d: any) => s + d.total_ventas, 0),
          descuentos: mensual.reduce((s: number, d: any) => s + d.total_descuentos, 0),
          efectivo: mensual.reduce((s: number, d: any) => s + d.efectivo, 0),
          debito: mensual.reduce((s: number, d: any) => s + d.debito, 0),
          credito: mensual.reduce((s: number, d: any) => s + d.credito, 0),
          a_credito: mensual.reduce((s: number, d: any) => s + d.a_credito, 0),
        };
      } else {
        totalesMes = null;
      }
    } catch (e) { console.error(e); }
    finally { loading = false; }
  }

  function formatCLP(n: number): string { return '$' + n.toLocaleString('es-CL'); }

  function deliveryTicketPromedio(): string {
    const td = delivery7dias.reduce((s, d) => s + d.total_ventas, 0);
    const cd = delivery7dias.reduce((s, d) => s + d.cantidad_pedidos, 0);
    return cd > 0 ? formatCLP(Math.round(td / cd)) : '$0';
  }

  function formatFecha(f: any): string {
    try {
      if (f instanceof Date) return f.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
      if (typeof f === 'string') return new Date(f.includes('T') ? f : f + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
      return String(f);
    } catch { return String(f); }
  }

  function getMesLabel(m: string): string {
    const [y, mo] = m.split('-');
    return new Date(+y, +mo - 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  }

  async function loadDetalles() {
    loadingDetalles = true;
    try {
      let url = `/api/admin/reportes?detalles=1&mes=${mesSeleccionado}`;
      if (filtroPagoMetodo) url += `&metodo_pago=${filtroPagoMetodo}`;
      const res = await fetch(url);
      const data = await res.json();
      detallePagos = data.detallePagos || [];
    } catch (e) { console.error(e); }
    finally { loadingDetalles = false; }
  }

  async function loadDeliveryData() {
    loadingDelivery = true;
    try {
      const res = await fetch(`/api/admin/reportes?tipo=delivery&mes=${mesSeleccionado}`);
      const data = await res.json();
      deliveryHoy = data.hoy || [];
      delivery7dias = data.ultimos7dias || [];
      deliveryTop = data.topProductos || [];
    } catch (e) { console.error(e); }
    finally { loadingDelivery = false; }
  }

  function groupByDate(list: any[]): Map<string, any[]> {
    const map = new Map<string, any[]>();
    for (const item of list) {
      const key = new Date(item.fecha_hora).toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }

  function formatFechaLarga(fechaHora: string): string {
    try {
      return new Date(fechaHora).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return fechaHora; }
  }

  function formatHora(fechaHora: string): string {
    try {
      return new Date(fechaHora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    } catch { return fechaHora; }
  }

  function formatMetodoLabel(m: string): string {
    const map: Record<string, string> = { efectivo: 'Efectivo', debito: 'Débito', credito: 'Crédito', a_credito: 'A crédito' };
    return map[m] || m;
  }

  $effect(() => {
    if (activeTab === 'detalles') loadDetalles();
    if (activeTab === 'delivery') loadDeliveryData();
  });

  let chartSegments: { offset: number; dash: number; color: string }[] = $state([]);
  let chartTotal: number = $state(0);

  $effect(() => {
    if (topProductos.length === 0) return;
    const total = topProductos.reduce((s: number, p: any) => s + p.total_cantidad, 0);
    chartTotal = total;
    const circumference = 2 * Math.PI * 40;
    let cumulative = 0;
    chartSegments = topProductos.map((p: any, i: number) => {
      const pct = p.total_cantidad / total;
      const dash = pct * circumference;
      const seg = { offset: cumulative, dash, color: chartColors[i % chartColors.length] };
      cumulative += dash;
      return seg;
    });
  });

  function imprimir() {
    let mensualRows = '';
    for (const d of mensual) {
      mensualRows += `<tr><td>${formatFecha(d.fecha)}</td><td class="r">${esc(d.garzones || '—')}</td><td class="r">${formatCLP(d.total_ventas)}</td><td class="r">${formatCLP(d.total_descuentos)}</td></tr>`;
    }

    let cajeraRows = '';
    for (const c of ventasPorCajera) {
      cajeraRows += `<tr><td>${esc(c.cajera || '—')}</td><td class="r">${c.total_pedidos}</td><td class="r">${formatCLP(c.total_ventas)}</td></tr>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte Mensual La Cascada</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:10px;padding:6px 8px;max-width:72mm;margin:0 auto;color:#000}
  .center{text-align:center}.bold{font-weight:bold}.divider{border-top:1px dashed #000;margin:5px 0}
  .r{text-align:right}table{width:100%;border-collapse:collapse;font-size:9px}
  th{background:#f0f0f0;text-align:left;padding:2px 3px;font-size:8px;text-transform:uppercase;color:#333}
  td{padding:2px 3px;border-bottom:1px solid #ddd}
  @media print{body{padding:4px 6px}}
</style></head><body>
<div class="center bold" style="font-size:12px">LA CASCADA</div>
<div class="center" style="font-size:8px">Reporte Mensual &bull; ${getMesLabel(mesSeleccionado)}</div>
<div class="divider"></div>
${totalesMes ? `
<div style="font-size:9px;margin-bottom:3px">RESUMEN DEL MES</div>
<div>Total Ventas: <span class="r bold" style="float:right">${formatCLP(totalesMes.ventas)}</span></div>
<div>Descuentos: <span class="r bold" style="float:right">${formatCLP(totalesMes.descuentos)}</span></div>
<div class="divider"></div>
` : ''}
<div style="font-size:9px;margin-bottom:3px">DETALLE POR DÍA</div>
<table><thead><tr><th>Fecha</th><th>Garzón</th><th class="r">Ventas</th><th class="r">Desc.</th></tr></thead><tbody>${mensualRows}</tbody></table>
<div class="divider"></div>
${ventasPorCajera.length > 0 ? `
<div style="font-size:9px;margin-bottom:3px">VENTAS POR CAJERA</div>
<table><thead><tr><th>Cajera</th><th class="r">Pedidos</th><th class="r">Ventas</th></tr></thead><tbody>${cajeraRows}</tbody></table>
<div class="divider"></div>
` : ''}
<div class="center" style="font-size:8px">La Cascada &bull; Reporte interno</div>
<script>window.onload=function(){window.print()}<` + `/script>
</body></html>`;

    const w = window.open('', '_blank', 'width=300,height=500');
    if (w) { w.document.write(html); w.document.close(); }
  }
</script>

<div class="p-4 sm:p-6">
  <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
    <h2 class="text-xl font-bold text-gray-900">Reportes</h2>
    <button class="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-1.5" onclick={imprimir}>
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
      Imprimir
    </button>
  </div>

  <nav class="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto scrollbar-hide">
    {#each tabs as tab}
      <button class="px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-[1px] whitespace-nowrap {activeTab === tab.id ? 'border-brand-600 text-brand-700 bg-brand-50' : 'border-transparent text-gray-500 hover:text-gray-700'}" onclick={() => { activeTab = tab.id }}><span class="mr-1.5">{tab.icon}</span>{tab.label}</button>
    {/each}
  </nav>

  {#if activeTab === 'ventas'}
    {#if loading}
      <p class="text-gray-400 text-center py-8">Cargando...</p>
    {:else}
      <!-- Hoy -->
      <div class="mb-6">
        <h3 class="text-base font-semibold text-gray-800 mb-2">Resumen del Día</h3>
        {#if hoy.length === 0}
          <div class="card p-4 text-center text-gray-500 text-sm">Sin ventas hoy</div>
        {:else}
          {@const d = hoy[0]}
          <div class="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
            <div class="card p-3 text-center"><p class="text-xs text-gray-500">Total Ventas</p><p class="text-lg font-bold text-brand-700">{formatCLP(d.total_ventas)}</p></div>
            <div class="card p-3 text-center"><p class="text-xs text-gray-500">Efectivo</p><p class="text-lg font-bold text-gray-900">{formatCLP(d.efectivo)}</p></div>
            <div class="card p-3 text-center"><p class="text-xs text-gray-500">Débito</p><p class="text-lg font-bold text-gray-900">{formatCLP(d.debito)}</p></div>
            <div class="card p-3 text-center"><p class="text-xs text-gray-500">Crédito</p><p class="text-lg font-bold text-gray-900">{formatCLP(d.credito)}</p></div>
            <div class="card p-3 text-center"><p class="text-xs text-gray-500">A Crédito</p><p class="text-lg font-bold text-gray-900">{formatCLP(d.a_credito)}</p></div>
          </div>
          <p class="text-xs text-gray-500">{d.cantidad_pedidos} pedidos &bull; {formatCLP(d.total_descuentos)} en descuentos</p>
        {/if}
      </div>

      <!-- Últimos 7 días -->
      <div class="mb-6">
        <h3 class="text-base font-semibold text-gray-800 mb-2">Últimos 7 Días</h3>
        {#if ultimos7dias.length === 0}
          <div class="card p-4 text-center text-gray-500 text-sm">Sin datos</div>
        {:else}
          <div class="card overflow-hidden overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="text-left p-2 font-medium text-gray-600">Fecha</th>
                  <th class="text-right p-2 font-medium text-gray-600">Pedidos</th>
                  <th class="text-right p-2 font-medium text-gray-600">Ventas</th>
                  <th class="text-right p-2 font-medium text-gray-600">Desc.</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                {#each ultimos7dias as d}
                  <tr class="hover:bg-gray-50">
                    <td class="p-2 font-medium">{formatFecha(d.fecha)}</td>
                    <td class="p-2 text-right">{d.cantidad_pedidos}</td>
                    <td class="p-2 text-right">{formatCLP(d.total_ventas)}</td>
                    <td class="p-2 text-right">{formatCLP(d.total_descuentos)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>

      <!-- Mensual -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-base font-semibold text-gray-800">Desglose Mensual</h3>
          <input type="month" class="input-field w-auto text-sm" bind:value={mesSeleccionado} onchange={loadData} />
        </div>
        {#if mensual.length === 0}
          <div class="card p-4 text-center text-gray-500 text-sm">Sin datos para {getMesLabel(mesSeleccionado)}</div>
        {:else}
          {#if totalesMes}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              <div class="card p-3 text-center"><p class="text-xs text-gray-500">Total Ventas</p><p class="text-lg font-bold text-brand-700">{formatCLP(totalesMes.ventas)}</p></div>
              <div class="card p-3 text-center"><p class="text-xs text-gray-500">Efectivo</p><p class="text-lg font-bold">{formatCLP(totalesMes.efectivo)}</p></div>
              <div class="card p-3 text-center"><p class="text-xs text-gray-500">Débito</p><p class="text-lg font-bold">{formatCLP(totalesMes.debito)}</p></div>
              <div class="card p-3 text-center"><p class="text-xs text-gray-500">Descuentos</p><p class="text-lg font-bold">{formatCLP(totalesMes.descuentos)}</p></div>
            </div>
          {/if}
          <div class="card overflow-hidden overflow-x-auto mb-4">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="text-left p-2 font-medium text-gray-600">Fecha</th>
                  <th class="text-left p-2 font-medium text-gray-600">Garzón</th>
                  <th class="text-right p-2 font-medium text-gray-600">Pedidos</th>
                  <th class="text-right p-2 font-medium text-gray-600">Ventas</th>
                  <th class="text-right p-2 font-medium text-gray-600">Desc.</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                {#each mensual as d}
                  <tr class="hover:bg-gray-50">
                    <td class="p-2 font-medium">{formatFecha(d.fecha)}</td>
                    <td class="p-2 text-gray-500 text-xs">{d.garzones || '—'}</td>
                    <td class="p-2 text-right">{d.cantidad_pedidos}</td>
                    <td class="p-2 text-right">{formatCLP(d.total_ventas)}</td>
                    <td class="p-2 text-right">{formatCLP(d.total_descuentos)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Ventas por Cajera -->
          {#if ventasPorCajera.length > 0}
            <h4 class="text-sm font-semibold text-gray-700 mb-2">Ventas por Cajera</h4>
            <div class="card overflow-hidden mb-4">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b">
                  <tr>
                    <th class="text-left p-2 font-medium text-gray-600">Cajera</th>
                    <th class="text-right p-2 font-medium text-gray-600">Pedidos</th>
                    <th class="text-right p-2 font-medium text-gray-600">Ventas</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  {#each ventasPorCajera as c}
                    <tr><td class="p-2 font-medium">{c.cajera || '—'}</td><td class="p-2 text-right">{c.total_pedidos}</td><td class="p-2 text-right font-bold text-brand-700">{formatCLP(c.total_ventas)}</td></tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Alimentos más consumidos -->
      <div>
        <h3 class="text-base font-semibold text-gray-800 mb-2">Alimentos más consumidos (30 días)</h3>
        {#if topProductos.length === 0}
          <div class="card p-4 text-center text-gray-500 text-sm">Sin datos</div>
        {:else}
          <div class="flex flex-col md:flex-row gap-4 items-center">
            <div class="relative w-40 h-40 shrink-0">
              <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90">
                {#each chartSegments as seg, i}
                  <circle cx="50" cy="50" r="40" fill="none" stroke={seg.color} stroke-width="18" stroke-dasharray={`${seg.dash} ${2 * Math.PI * 40 - seg.dash}`} stroke-dashoffset={-seg.offset} />
                {/each}
                <circle cx="50" cy="50" r="30" fill="white" />
                <text x="50" y="50" text-anchor="middle" dy="5" fill="#111" font-size="11" font-weight="bold">{chartTotal}</text>
              </svg>
            </div>
            <div class="flex-1 space-y-1.5 w-full">
              {#each topProductos as p, i}
                {@const pct = chartTotal > 0 ? Math.round(p.total_cantidad / chartTotal * 100) : 0}
                <div class="flex items-center gap-2">
                  <div class="w-2.5 h-2.5 rounded-full shrink-0" style="background:{chartColors[i % chartColors.length]}"></div>
                  <span class="flex-1 text-sm text-gray-700">{p.nombre}</span>
                  <span class="text-sm text-gray-500">{p.total_cantidad}u</span>
                  <span class="text-sm font-semibold">{formatCLP(p.total_recaudado)}</span>
                  <span class="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
    </div>
  {/if}

  {:else if activeTab === 'detalles'}
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <input type="month" class="input-field w-auto text-sm" bind:value={mesSeleccionado} onchange={loadDetalles} />
        <select class="input-field w-auto text-sm" bind:value={filtroPagoMetodo} onchange={loadDetalles}>
          <option value="">Todos los métodos</option>
          <option value="efectivo">Efectivo</option>
          <option value="debito">Débito</option>
          <option value="credito">Crédito</option>
          <option value="a_credito">A crédito</option>
        </select>
      </div>
      <span class="text-xs text-gray-500">{detallePagos.length} pagos encontrados</span>
    </div>

    {#if loadingDetalles}
      <p class="text-gray-400 text-center py-8">Cargando...</p>
    {:else if detallePagos.length === 0}
      <div class="card p-6 text-center text-gray-500">Sin pagos para {getMesLabel(mesSeleccionado)}</div>
    {:else}
      {#each [...groupByDate(detallePagos)] as [fecha, pagos]}
        <div class="mb-6">
          <h3 class="text-base font-semibold text-gray-800 mb-2 capitalize">{formatFechaLarga(pagos[0].fecha_hora)}</h3>
          <div class="card overflow-hidden overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 border-b">
                <tr>
                  <th class="text-left p-2 font-medium text-gray-600">Hora</th>
                  <th class="text-left p-2 font-medium text-gray-600">Comanda</th>
                  <th class="text-left p-2 font-medium text-gray-600">Cajera</th>
                  <th class="text-left p-2 font-medium text-gray-600">Mesa</th>
                  <th class="text-left p-2 font-medium text-gray-600">Pago</th>
                  <th class="text-right p-2 font-medium text-gray-600">Total</th>
                  <th class="text-right p-2 font-medium text-gray-600">Desc.</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                {#each pagos as p}
                  <tr class="hover:bg-gray-50">
                    <td class="p-2 text-xs text-gray-500">{formatHora(p.fecha_hora)}</td>
                    <td class="p-2 font-mono font-bold text-gray-900">#{p.pedido_id}</td>
                    <td class="p-2 text-xs text-gray-500">{p.cajera || '—'}</td>
                    <td class="p-2 font-medium">{p.numero_mesa ? `P${p.mesa_piso} M${p.numero_mesa}` : '—'}</td>
                    <td class="p-2"><span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{formatMetodoLabel(p.metodo_pago)}</span></td>
                    <td class="p-2 text-right font-medium">{formatCLP(p.total)}</td>
                    <td class="p-2 text-right text-red-500">{p.descuento > 0 ? formatCLP(p.descuento) : '—'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/each}
    {/if}

  {:else if activeTab === 'delivery'}
    {#if loadingDelivery}
      <div class="text-center py-12 text-gray-500">Cargando reportes delivery...</div>
    {:else}
      <div class="space-y-6">
        <h3 class="text-lg font-bold text-gray-900">🛵 Reportes Delivery</h3>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="card p-4 text-center">
            <p class="text-sm text-gray-500">Ventas hoy</p>
            <p class="text-2xl font-bold text-brand-700">{formatCLP(deliveryHoy.reduce((s: number, d: any) => s + d.total_ventas, 0))}</p>
            <p class="text-xs text-gray-400">{deliveryHoy.reduce((s: number, d: any) => s + d.cantidad_pedidos, 0)} pedidos</p>
          </div>
          <div class="card p-4 text-center">
            <p class="text-sm text-gray-500">7 días</p>
            <p class="text-2xl font-bold text-brand-700">{formatCLP(delivery7dias.reduce((s: number, d: any) => s + d.total_ventas, 0))}</p>
            <p class="text-xs text-gray-400">{delivery7dias.reduce((s: number, d: any) => s + d.cantidad_pedidos, 0)} pedidos</p>
          </div>
          <div class="card p-4 text-center">
            <p class="text-sm text-gray-500">Ticket promedio</p>
            <p class="text-2xl font-bold text-brand-700">{deliveryTicketPromedio()}</p>
          </div>
        </div>

        {#if delivery7dias.length > 0}
          <div class="card p-4">
            <h4 class="font-semibold text-gray-900 mb-3">Últimos 7 días</h4>
            <div class="space-y-2">
              {#each delivery7dias as d}
                <div class="flex justify-between items-center text-sm">
                  <span class="text-gray-600">{formatFecha(d.fecha)}</span>
                  <span class="text-gray-500">{d.cantidad_pedidos} pedidos</span>
                  <span class="font-semibold text-brand-700">{formatCLP(d.total_ventas)}</span>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="text-center py-8 text-gray-400">Sin datos de delivery en los últimos 7 días</div>
        {/if}

        {#if deliveryTop.length > 0}
          <div class="card p-4">
            <h4 class="font-semibold text-gray-900 mb-3">Top productos delivery (30 días)</h4>
            <div class="space-y-2">
              {#each deliveryTop as p, i}
                <div class="flex justify-between items-center text-sm">
                  <span class="text-gray-600">#{i + 1} {p.nombre}</span>
                  <span class="text-gray-500">{p.total_cantidad} unid.</span>
                  <span class="font-semibold text-brand-700">{formatCLP(p.total_recaudado)}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
</style>
