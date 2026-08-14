<script lang="ts">
  import { onMount } from 'svelte';

  let { usuario = '' }: { usuario?: string } = $props();

  let accion: string = $state('abrir');
  let loading: boolean = $state(false);
  let error: string = $state('');
  let exito: string = $state('');
  let cajaActiva: any | null = $state(null);

  let efectivoInicial: number = $state(0);
  let comentarios: string = $state('');
  let efectivoFinal: number = $state(0);

  let cajaIdPreview: string = $state('');

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    accion = params.get('accion') || 'abrir';

    const now = new Date();
    cajaIdPreview = 'CAJA-' + String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');

    try {
      const res = await fetch('/api/admin/cajas?activa=1');
      const data = await res.json();
      if (data.cajas?.length > 0) {
        cajaActiva = data.cajas[0];
      }
    } catch (e) {
      error = 'No se pudo verificar el estado de la caja. Recarga la página antes de continuar.';
    }
  });

  async function abrirCaja() {
    loading = true; error = '';
    try {
      const res = await fetch('/api/admin/cajas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ efectivo_inicial: efectivoInicial, comentarios }),
      });
      const data = await res.json();
      if (res.ok) {
        exito = `Caja #${data.caja.id} abierta correctamente`;
        cajaActiva = data.caja;
      } else {
        error = data.error || 'Error al abrir caja';
      }
    } catch (e) { error = 'Error de conexión'; }
    finally { loading = false; }
  }

  async function cerrarCaja() {
    if (!cajaActiva) return;
    if (!confirm('¿Cerrar la caja #' + cajaActiva.id + '?')) return;
    loading = true; error = '';
    try {
      const res = await fetch('/api/admin/cajas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cajaActiva.id, estado: 'cerrada', efectivo_final: efectivoFinal }),
      });
      if (res.ok) {
        window.location.href = '/admin';
      } else {
        const data = await res.json();
        error = data.error || 'Error al cerrar caja';
      }
    } catch (e) { error = 'Error de conexión'; }
    finally { loading = false; }
  }

  function formatCLP(n: number): string { return '$' + n.toLocaleString('es-CL'); }

  function esc(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function metodoLabel(m: string): string {
    const map: Record<string, string> = { efectivo: 'Efectivo', debito: 'Débito', credito: 'Crédito', a_credito: 'A crédito (fiado)' };
    return map[m] || m || '—';
  }

  function horaLocal(f: string): string {
    try { return new Date(f).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }); } catch { return f; }
  }

  let printingReporte: boolean = $state(false);

  async function imprimirReporteDia() {
    if (printingReporte) return;
    printingReporte = true;
    try {
      const now = new Date();
      const fecha = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const res = await fetch(`/api/admin/reportes/dia?fecha=${fecha}`);
      const d = await res.json();
      if (!res.ok || !d.resumen) {
        alert(d.error || 'No se pudo cargar el reporte del día');
        return;
      }
      const r = d.resumen;

      // Ranking de garzones por mesas atendidas (pedidos tipo mesa)
      const porGarzon: Record<string, { mesas: Set<number>; pedidos: number; total: number }> = {};
      for (const p of d.pedidosDia) {
        if (p.tipo_pedido !== 'mesa') continue;
        const g = p.tomada_por || p.nombre_cliente || 'Autoservicio';
        if (!porGarzon[g]) porGarzon[g] = { mesas: new Set(), pedidos: 0, total: 0 };
        if (p.numero_mesa) porGarzon[g].mesas.add(p.numero_mesa);
        porGarzon[g].pedidos++;
        porGarzon[g].total += p.total;
      }
      const ranking = Object.entries(porGarzon)
        .map(([nombre, v]) => ({ nombre, mesas: v.mesas.size, pedidos: v.pedidos, total: v.total }))
        .sort((a, b) => b.mesas - a.mesas || b.total - a.total);
      const top = ranking[0] || null;

      const fechaLarga = now.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      const platosRows = d.productosDia.map((p: any) =>
        `<tr><td>${esc(p.nombre)}</td><td class="r">${p.cantidad}</td><td class="r">${formatCLP(p.recaudado)}</td></tr>`
      ).join('');

      const garzonRows = ranking.map(g =>
        `<tr><td>${esc(g.nombre)}</td><td class="r">${g.mesas}</td><td class="r">${g.pedidos}</td><td class="r">${formatCLP(g.total)}</td></tr>`
      ).join('');

      const pedidosRows = d.pedidosDia.map((p: any) => {
        const donde = p.tipo_pedido === 'mesa' && p.numero_mesa
          ? `Mesa ${p.numero_mesa}${p.tomada_por ? ' · ' + esc(p.tomada_por) : ''}`
          : esc(p.nombre_cliente || p.tipo_pedido);
        return `<tr><td>${horaLocal(p.fecha_hora)}</td><td>#${p.id} ${donde}</td><td>${metodoLabel(p.metodo_pago)}</td><td class="r">${formatCLP(p.total)}</td></tr>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte del Día La Cascada</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:10px;padding:6px 8px;max-width:72mm;margin:0 auto;color:#000}
  .center{text-align:center}.bold{font-weight:bold}.divider{border-top:1px dashed #000;margin:5px 0}
  .r{text-align:right}table{width:100%;border-collapse:collapse;font-size:9px}
  th{background:#f0f0f0;text-align:left;padding:2px 3px;font-size:8px;text-transform:uppercase;color:#333}
  td{padding:2px 3px;border-bottom:1px solid #ddd}
  .sec{font-size:9px;font-weight:bold;margin:4px 0 2px}
  @media print{body{padding:4px 6px}}
</style></head><body>
<div class="center bold" style="font-size:13px">LA CASCADA</div>
<div class="center" style="font-size:9px">Reporte del día &bull; ${fechaLarga}</div>
<div class="divider"></div>
<div class="sec">RESUMEN DE VENTAS</div>
<div>Pedidos: <span class="r bold" style="float:right">${r.cantidad_pedidos}</span></div>
<div>Efectivo: <span class="r" style="float:right">${formatCLP(r.efectivo)}</span></div>
<div>Débito: <span class="r" style="float:right">${formatCLP(r.debito)}</span></div>
<div>Crédito: <span class="r" style="float:right">${formatCLP(r.credito)}</span></div>
<div>Fiado: <span class="r" style="float:right">${formatCLP(r.a_credito)}</span></div>
<div>Descuentos: <span class="r" style="float:right">${formatCLP(r.total_descuentos)}</span></div>
<div class="bold" style="font-size:11px">TOTAL: <span class="r" style="float:right">${formatCLP(r.total_ventas)}</span></div>
<div class="divider"></div>
${cajaActiva ? `
<div class="sec">CAJA</div>
<div>Apertura: ${horaLocal(cajaActiva.abierta_desde)} &bull; Inicial: ${formatCLP(cajaActiva.efectivo_inicial)}</div>
${cajaActiva.efectivo_esperado != null ? `<div>Efectivo esperado: <span class="r bold" style="float:right">${formatCLP(cajaActiva.efectivo_esperado)}</span></div>` : ''}
<div class="divider"></div>
` : ''}
${ranking.length > 0 ? `
<div class="sec">ATENCIÓN POR GARZÓN</div>
<table><thead><tr><th>Garzón</th><th class="r">Mesas</th><th class="r">Pedidos</th><th class="r">Vendido</th></tr></thead><tbody>${garzonRows}</tbody></table>
${top ? `<div style="margin-top:2px">Más mesas atendió: <span class="bold">${esc(top.nombre)}</span> (${top.mesas} mesa${top.mesas === 1 ? '' : 's'})</div>` : ''}
<div class="divider"></div>
` : ''}
<div class="sec">PLATOS CONSUMIDOS</div>
<table><thead><tr><th>Plato</th><th class="r">Cant.</th><th class="r">Total</th></tr></thead><tbody>${platosRows}</tbody></table>
<div class="divider"></div>
<div class="sec">PEDIDOS DEL DÍA</div>
<table><thead><tr><th>Hora</th><th>Pedido</th><th>Pago</th><th class="r">Total</th></tr></thead><tbody>${pedidosRows}</tbody></table>
<div class="divider"></div>
<div class="center" style="font-size:8px">La Cascada &bull; Cierre de caja</div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`;

      const w = window.open('', '_blank', 'width=320,height=600');
      if (w) { w.document.write(html); w.document.close(); }
    } catch (e) {
      alert('Error de conexión al generar el reporte');
    } finally {
      printingReporte = false;
    }
  }

  let resetTexto: string = $state('');
  let resetting: boolean = $state(false);
  let resetError: string = $state('');

  async function reiniciarOperacion() {
    if (resetTexto !== 'REINICIAR' || resetting) return;
    resetting = true; resetError = '';
    try {
      const res = await fetch('/api/admin/reset-operacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'REINICIAR' }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Operación reiniciada. Ventas, pedidos, cajas y saldos parten desde cero.');
        window.location.href = '/admin';
      } else {
        resetError = data.error || 'Error al reiniciar';
      }
    } catch (e) { resetError = 'Error de conexión'; }
    finally { resetting = false; }
  }
</script>

<div class="p-4 sm:p-6 max-w-lg mx-auto">
  <h2 class="text-xl font-bold text-gray-900 mb-6">{accion === 'cerrar' ? 'Cerrar Caja' : 'Abrir Caja'}</h2>

  {#if exito}
    <div class="card p-8 text-center">
      <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
      </div>
      <h3 class="text-lg font-bold text-gray-900 mb-2">¡Caja Abierta!</h3>
      <p class="text-gray-600">{exito}</p>
      {#if cajaActiva}
        <p class="text-sm text-gray-500 mt-2">Efectivo inicial: {formatCLP(cajaActiva.efectivo_inicial)}</p>
      {/if}
    </div>

  {:else if accion === 'cerrar' && cajaActiva}
    <!-- Cerrar Caja -->
    <div class="card p-6 space-y-4">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span class="text-gray-500">ID Caja:</span>
          <p class="font-bold text-gray-900">#{cajaActiva.id}</p>
        </div>
        <div class="text-right">
          <span class="text-gray-500">Nombre:</span>
          <p class="font-bold text-gray-900">{cajaActiva.nombre}</p>
        </div>
        <div>
          <span class="text-gray-500">Usuario:</span>
          <p class="font-medium text-gray-900">{cajaActiva.usuario}</p>
        </div>
        <div class="text-right">
          <span class="text-gray-500">Efectivo Inicial:</span>
          <p class="font-bold text-gray-900">{formatCLP(cajaActiva.efectivo_inicial)}</p>
        </div>
      </div>

      {#if cajaActiva.efectivo_esperado != null}
        <div class="bg-green-50 rounded-lg p-3 border border-green-200">
          <p class="text-xs text-green-700 font-medium">Efectivo esperado (inicial + pagos en efectivo)</p>
          <p class="text-xl font-bold text-green-800">{formatCLP(cajaActiva.efectivo_esperado)}</p>
        </div>
      {/if}

      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1.5">Efectivo Final</label>
        <div class="flex items-center gap-2">
          <span class="text-gray-400">$</span>
          <input type="number" class="input-field" min="0" bind:value={efectivoFinal} placeholder="0" />
        </div>
      </div>

      {#if error}
        <div class="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
      {/if}

      <button
        class="w-full py-2.5 rounded-lg border border-brand-300 text-brand-700 font-semibold text-sm hover:bg-brand-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        disabled={printingReporte}
        onclick={imprimirReporteDia}
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
        {printingReporte ? 'Generando...' : 'Imprimir reporte del día'}
      </button>

      <button class="btn-danger w-full py-3 disabled:opacity-50" disabled={loading} onclick={cerrarCaja}>
        {loading ? 'Cerrando...' : 'Cerrar Caja'}
      </button>
    </div>

  {:else if accion === 'cerrar' && !cajaActiva}
    <div class="card p-6 text-center text-gray-500">
      <p>No hay caja abierta actualmente.</p>
    </div>

  {:else}
    <!-- Abrir Caja -->
    <div class="card p-6 space-y-5">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">ID de la Caja</label>
          <p class="text-sm font-bold text-brand-700 font-mono">{cajaIdPreview}</p>
        </div>
        <div class="text-right">
          <label class="block text-xs font-semibold text-gray-500 mb-1">Nombre de Caja</label>
          <p class="text-sm font-bold text-gray-900">Caja Principal</p>
        </div>
      </div>

      <div class="bg-gray-50 rounded-lg p-3">
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">Usuario:</span>
          <span class="font-medium text-gray-900">{usuario}</span>
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1.5">Efectivo Inicial</label>
        <div class="flex items-center gap-2">
          <span class="text-gray-400 text-lg">$</span>
          <input type="number" class="input-field text-lg" min="0" bind:value={efectivoInicial} placeholder="0" />
        </div>
      </div>

      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1.5">Comentarios</label>
        <textarea class="input-field h-16 resize-none" bind:value={comentarios} placeholder="Notas de apertura..."></textarea>
      </div>

      {#if error}
        <div class="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
      {/if}

      <div class="flex gap-3">
        <button class="flex-1 btn-secondary py-3" onclick={() => window.location.href = '/admin'}>Cancelar</button>
        <button class="flex-1 btn-primary py-3 disabled:opacity-50" disabled={loading} onclick={abrirCaja}>
          {loading ? 'Abriendo...' : 'Abrir Caja'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Zona de peligro: reiniciar operación desde cero -->
  <div class="card p-5 mt-8 border border-red-200">
    <h3 class="text-sm font-bold text-red-700 mb-1">Zona de peligro</h3>
    <p class="text-xs text-gray-500 mb-3">
      Borra todas las ventas, pedidos, cajas, turnos, reservas y saldos de fiado para empezar desde cero.
      <strong>No</strong> elimina usuarios, productos, categorías ni mesas. Esta acción no se puede deshacer.
    </p>
    <label class="block text-xs font-semibold text-gray-600 mb-1">Escribe REINICIAR para confirmar</label>
    <input class="input-field text-sm mb-2" bind:value={resetTexto} placeholder="REINICIAR" />
    {#if resetError}
      <div class="bg-red-50 text-red-700 text-sm p-2 rounded-lg mb-2">{resetError}</div>
    {/if}
    <button
      class="btn-danger w-full py-2.5 disabled:opacity-40"
      disabled={resetTexto !== 'REINICIAR' || resetting}
      onclick={reiniciarOperacion}
    >
      {resetting ? 'Reiniciando...' : 'Reiniciar operación desde cero'}
    </button>
  </div>
</div>
