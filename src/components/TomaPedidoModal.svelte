<script lang="ts">
  import { onMount } from 'svelte';
  import type { Mesa, Categoria, Producto, Acompanamiento, ProductoAcompanamiento } from '../lib/types';
  import { GRUPOS_MENU, METODOS_PAGO, MAX_CANTIDAD_POR_PRODUCTO } from '../lib/constants';
  import { fetchTimeout } from '../lib/fetch-utils';

  function generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function esc(s: string): string {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  let { mesa, onclose } = $props<{ mesa: Mesa; onclose: () => void }>();

  let step: string = $state(mesa.estado === 'libre' ? 'abrir' : 'cargando');
  let garzonId: string = $state('');
  let comensales: number = $state(1);
  let garzones: any[] = $state([]);
  let categorias: Categoria[] = $state([]);
  let productos: Producto[] = $state([]);
  let acompanamientos: Acompanamiento[] = $state([]);
  let productosAcomp: ProductoAcompanamiento[] = $state([]);
  let comensalesList: ComensalOrden[] = $state([]);
  let activeGrupo: string = $state('completos_ases');
  let activeComensal: number = $state(0);
  let loading: boolean = $state(true);
  let saving: boolean = $state(false);

  let descuento: number = $state(0);
  let metodoPago: string = $state('efectivo');
  let montoPagado: number = $state(0);
  let pedidosInfo: PedidoInfo[] = $state([]);
  let pagoComensalIdx: number = $state(-1);
  let itemsOriginalesIds: Set<string> = new Set();
  let showAcompModal: boolean = $state(false);
  let acompProducto: Producto | null = $state(null);
  let selectedAcomps: number[] = $state([]);
  let acompNombre: string = $state('');

  interface OrdenItem {
    id: string;
    producto: Producto;
    cantidad: number;
    acompanamiento: string | null;
    subtotal: number;
  }

  interface ComensalOrden {
    id: number;
    label: string;
    items: OrdenItem[];
    comentarios: string;
  }

  interface PedidoInfo {
    comensalIdx: number;
    pedidoId: number;
    pagado: boolean;
    voucher?: any;
    descuentoAplicado: number;
    montoPagadoAplicado: number;
    metodoPagoAplicado: string;
  }

  const grupos = GRUPOS_MENU;

  const metodosPago = METODOS_PAGO;

  onMount(async () => {
    try {
      const [gRes, mRes, pRes] = await Promise.all([
        fetch('/api/admin/garzones'),
        fetch('/api/menu'),
        fetch(`/api/admin/pedidos?estado=pendiente&estado=en_preparacion&estado=entregado`),
      ]);
      const gData = await gRes.json();
      const mData = await mRes.json();
      const pData = await pRes.json();
      garzones = gData.garzones || [];
      categorias = mData.categorias || [];
      productos = mData.productos || [];
      acompanamientos = mData.acompanamientos || [];
      productosAcomp = mData.productos_acompanamientos || [];

      if (mesa.estado !== 'libre') {
        const pedidosMesa = (pData.pedidos || []).filter((p: any) =>
          p.mesa_id === mesa.id &&
          (p.tipo_pedido === 'mesa' || p.tipo_pedido === 'reserva') &&
          p.estado !== 'pagado' &&
          p.estado !== 'cancelado'
        );

        if (pedidosMesa.length > 0) {
          const detallesPromises = pedidosMesa.map((p: any) =>
            fetch(`/api/admin/pedidos/${p.id}/detalles`).then(r => r.json())
          );
          const detallesResults = await Promise.all(detallesPromises);

          comensalesList = pedidosMesa.map((p: any, i: number) => {
            const items = (detallesResults[i]?.detalles || []).map((d: any) => {
              const uid = generateId();
              itemsOriginalesIds.add(uid);
              return {
                id: uid,
                producto: {
                  id: d.producto_id,
                  nombre: d.producto_nombre,
                  precio: d.producto_precio,
                  categoria_id: 0,
                  descripcion: null,
                  ingredientes: null,
                  maneja_stock: false,
                  stock_actual: 0,
                  disponible_dia: true,
                  imagen_url: null,
                  created_at: '',
                  updated_at: '',
                } as any,
                cantidad: d.cantidad,
                acompanamiento: d.acompanamiento || null,
                subtotal: d.subtotal || d.producto_precio * d.cantidad,
              };
            });
            return { id: i + 1, label: `Pedido #${p.id}`, items, comentarios: '' };
          });

          pedidosInfo = pedidosMesa.map((p: any, i: number) => ({
            comensalIdx: i,
            pedidoId: p.id,
            pagado: p.estado === 'pagado',
          }));
          step = 'orden';
        } else {
          step = 'abrir';
        }
      }
    } catch (e) {
      console.error('Error cargando datos:', e);
      step = 'abrir';
    } finally {
      loading = false;
    }
  });

  function getProductosGrupo(grupoId: string): Producto[] {
    const grupo = grupos.find(g => g.id === grupoId);
    if (!grupo) return [];
    const catIds = categorias.filter(c => grupo.cats.includes(c.nombre)).map(c => c.id);
    return productos.filter(p => catIds.includes(p.categoria_id));
  }

  function getAcompForProducto(id: number): Acompanamiento[] {
    const ids = productosAcomp.filter(pa => pa.producto_id === id).map(pa => pa.acompanamiento_id);
    return acompanamientos.filter(a => ids.includes(a.id));
  }

  function openAcompModal(prod: Producto) {
    acompProducto = prod;
    selectedAcomps = [];
    acompNombre = '';
    showAcompModal = true;
  }

  function closeAcompModal() {
    showAcompModal = false;
    acompProducto = null;
    selectedAcomps = [];
  }

  function confirmarAcomp() {
    if (!acompProducto) return;
    const names: string[] = [];
    for (const id of selectedAcomps) {
      const a = acompanamientos.find(x => x.id === id);
      if (a) names.push(a.nombre);
    }
    acompNombre = names.length > 0 ? names.join(', ') : 'Sin acompañamiento';
    addProductoWithAcomp(acompProducto, acompNombre);
    closeAcompModal();
  }

  function getActiveItems(): OrdenItem[] {
    const c = comensalesList[activeComensal];
    return c ? c.items : [];
  }

  function addProducto(prod: Producto) {
    if (getAcompForProducto(prod.id).length > 0) {
      openAcompModal(prod);
      return;
    }
    addProductoWithAcomp(prod, null);
  }

  function addProductoWithAcomp(prod: Producto, acomp: string | null) {
    const comensal = comensalesList[activeComensal];
    if (!comensal) return;
    let recargo = 0;
    if (acomp && acomp !== 'Sin acompañamiento') {
      const names = acomp.split(',').map(n => n.trim());
      for (const name of names) {
        const a = acompanamientos.find(x => x.nombre === name);
        if (a) recargo += a.recargo;
      }
    }
    const st = (prod.precio + recargo) * 1;
    const existing = comensal.items.find(i => i.producto.id === prod.id);
    if (existing) {
      if (existing.cantidad >= MAX_CANTIDAD_POR_PRODUCTO) return;
      comensal.items = comensal.items.map(i => i.id === existing.id ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.producto.precio + recargo) * (i.cantidad + 1) } : i);
    } else {
      comensal.items = [...comensal.items, { id: generateId(), producto: prod, cantidad: 1, acompanamiento: acomp, subtotal: st }];
    }
    comensalesList = [...comensalesList];
  }

  function removeItem(itemId: string) {
    const comensal = comensalesList[activeComensal];
    if (!comensal) return;
    comensal.items = comensal.items.filter(i => i.id !== itemId);
    comensalesList = [...comensalesList];
  }

  function updateCantidad(itemId: string, delta: number) {
    const comensal = comensalesList[activeComensal];
    if (!comensal) return;
    comensal.items = comensal.items.map(i => {
      if (i.id !== itemId) return i;
      const nueva = i.cantidad + delta;
      if (nueva <= 0) return i;
      if (nueva > MAX_CANTIDAD_POR_PRODUCTO) return i;
      return { ...i, cantidad: nueva };
    }).filter(i => i.cantidad > 0);
    comensalesList = [...comensalesList];
  }

  function getComensalTotal(idx: number): number {
    const c = comensalesList[idx];
    if (!c) return 0;
    return c.items.reduce((sum, i) => sum + (i.subtotal || i.producto.precio * i.cantidad), 0);
  }

  function getComensalItemsCount(idx: number): number {
    const c = comensalesList[idx];
    if (!c) return 0;
    return c.items.reduce((sum, i) => sum + i.cantidad, 0);
  }

  function getSubtotalGlobal(): number {
    return comensalesList.reduce((sum, c) => sum + c.items.reduce((s, i) => s + (i.subtotal || i.producto.precio * i.cantidad), 0), 0);
  }

  function getSubtotalPendiente(): number {
    return comensalesList.reduce((sum, c, idx) => {
      const pi = pedidosInfo.find(p => p.comensalIdx === idx);
      if (pi?.pagado) return sum;
      return sum + c.items.reduce((s, i) => s + (i.subtotal || i.producto.precio * i.cantidad), 0);
    }, 0);
  }

  function getTotalFinal(): number {
    return Math.max(0, (pagoComensalIdx === -1 ? getSubtotalPendiente() : getComensalTotal(pagoComensalIdx)) - descuento);
  }

  function hasItems(): boolean {
    if (pedidosInfo.length > 0) return true;
    return comensalesList.some(c => c.items.length > 0);
  }

  function volverAEditar() {
    pedidosInfo = [];
    pagoComensalIdx = -1;
    descuento = 0;
    montoPagado = 0;
    metodoPago = 'efectivo';
  }

  function volverAlMenu() {
    onclose();
  }

  function comensalPagado(idx: number): boolean {
    return pedidosInfo.some(p => p.comensalIdx === idx && p.pagado);
  }

  function todosPagados(): boolean {
    if (pedidosInfo.length > 0) return pedidosInfo.every(p => p.pagado);
    const conItems = comensalesList.filter(c => c.items.length > 0);
    if (conItems.length === 0) return false;
    return conItems.every(c => comensalPagado(c.id - 1));
  }

  function pedidosRestantes(): number {
    if (pedidosInfo.length > 0) return pedidosInfo.filter(p => !p.pagado).length;
    const conItems = comensalesList.filter(c => c.items.length > 0);
    return conItems.filter(c => !comensalPagado(c.id - 1)).length;
  }

  function abrirMesa() {
    if (!garzonId || comensales < 1) return;
    comensalesList = Array.from({ length: comensales }, (_, i) => ({
      id: i + 1,
      label: `Comensal ${i + 1}`,
      items: [],
      comentarios: '',
    }));
    activeComensal = 0;
    step = 'orden';
  }

  async function confirmarPedido() {
    if (!hasItems()) return;
    saving = true;
    const garzonNombre = garzones.find(g => String(g.id) === garzonId)?.nombre || '';

    try {
      await fetch('/api/admin/mesas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mesa.id, estado: 'ocupada', tomada_por: garzonNombre }),
      });

      const comensalesConItemsNuevos = comensalesList
        .map((c, idx) => ({
          c,
          idx,
          itemsNuevos: c.items.filter(i => !itemsOriginalesIds.has(i.id)),
        }))
        .filter(({ itemsNuevos }) => itemsNuevos.length > 0);

      if (comensalesConItemsNuevos.length === 0) {
        alert('No hay items nuevos para enviar a cocina.');
        saving = false;
        return;
      }

      const resultados = await Promise.all(
        comensalesConItemsNuevos.map(({ itemsNuevos, idx }) =>
          fetch('/api/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              piso: mesa.piso,
              mesa: mesa.numero_mesa,
              items: itemsNuevos.map(i => ({
                producto_id: i.producto.id,
                cantidad: i.cantidad,
                acompanamiento: i.acompanamiento || null,
                subtotal: i.subtotal || i.producto.precio * i.cantidad,
              })),
              total: itemsNuevos.reduce((s, i) => s + (i.subtotal || i.producto.precio * i.cantidad), 0),
              comentarios: comensalesList[idx].comentarios?.trim() || null,
            }),
          }).then(r => r.json())
        )
      );

      const nuevosIds = resultados
        .map((r, i) => ({
          comensalIdx: comensalesConItemsNuevos[i].idx,
          pedidoId: r.pedido_id,
          pagado: false,
        }))
        .filter(p => p.pedidoId);

      pedidosInfo = [...pedidosInfo, ...nuevosIds];

      for (const { itemsNuevos } of comensalesConItemsNuevos) {
        for (const item of itemsNuevos) {
          itemsOriginalesIds.add(item.id);
        }
      }

      pagoComensalIdx = -1;
    } catch (e) {
      console.error('Error:', e);
      alert('Error al crear pedidos');
    } finally {
      saving = false;
    }
  }

  async function realizarPago() {
    if (pedidosInfo.length === 0) return;

    // Validación: en efectivo el monto debe cubrir el total
    if (metodoPago === 'efectivo') {
      const total = getTotalFinal();
      if (!montoPagado || montoPagado < total) {
        alert(`El monto con que paga ($${(montoPagado || 0).toLocaleString('es-CL')}) debe ser igual o mayor al total ($${total.toLocaleString('es-CL')})`);
        return;
      }
    }

    saving = true;
    try {
      await fetch('/api/admin/mesas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mesa.id, estado: 'esperando_pago' }),
      });

      let aPagar;
      if (pagoComensalIdx === -1) {
        aPagar = pedidosInfo.filter(p => !p.pagado);
      } else if (comensalesList.some(c => c.items.length > 0)) {
        aPagar = pedidosInfo.filter(p => p.comensalIdx === pagoComensalIdx && !p.pagado);
      } else {
        aPagar = pedidosInfo.filter(p => p.pedidoId === pagoComensalIdx && !p.pagado);
      }

      for (const p of aPagar) {
        const res = await fetchTimeout('/api/pagos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pedido_id: p.pedidoId,
            metodo_pago: metodoPago,
            descuento: descuento,
            efectivo_con_cuanto: metodoPago === 'efectivo' ? montoPagado : 0,
          }),
        }, 15000);
        if (res.ok) {
          const data = await res.json();
          pedidosInfo = pedidosInfo.map(pi => pi.pedidoId === p.pedidoId
            ? { ...pi, pagado: true, voucher: data.voucher, descuentoAplicado: descuento, montoPagadoAplicado: montoPagado, metodoPagoAplicado: metodoPago }
            : pi
          );
        } else {
          const err = await res.json();
          alert(err.error || 'Error al procesar pago');
          return;
        }
      }

      descuento = 0;
      montoPagado = 0;
      metodoPago = 'efectivo';
      pagoComensalIdx = -1;
    } catch (e) {
      console.error('Error:', e);
      alert('Error de conexión');
    } finally {
      saving = false;
    }
  }

  function imprimirTicket(p: PedidoInfo) {
    if (!p.voucher) return;
    const metodoLabel = metodosPago.find(m => m.id === p.metodoPagoAplicado)?.label || p.metodoPagoAplicado;
    abrirVoucher([p.voucher], p.descuentoAplicado, 0, 'monto', p.montoPagadoAplicado, metodoLabel);
  }

  function imprimirTicketGeneral() {
    const pagados = pedidosInfo.filter(pi => pi.voucher);
    if (pagados.length === 0) return;
    const vouchers = pagados.map(pi => pi.voucher);
    const descTotal = pagados.reduce((s, pi) => s + pi.descuentoAplicado, 0);
    const montoTotal = pagados.reduce((s, pi) => s + pi.montoPagadoAplicado, 0);
    const metodos = [...new Set(pagados.map(pi => metodosPago.find(m => m.id === pi.metodoPagoAplicado)?.label || pi.metodoPagoAplicado))];
    const metodoStr = metodos.join(' + ');
    abrirVoucher(vouchers, descTotal, 0, 'monto', montoTotal, metodoStr);
  }

  function abrirVoucher(vouchers: any[], descAplicado: number, propAplicada: number, propTipo: string, montoPag: number, metodoStr: string) {
    const todosLosItems: any[] = [];
    let subtotalGeneral = 0;
    for (const v of vouchers) {
      for (const d of v.detalles) {
        todosLosItems.push(d);
      }
      subtotalGeneral += v.total;
    }

    function getAcompRecargo(name: string): number {
      return acompanamientos.find(a => a.nombre === name)?.recargo || 0;
    }

    function buildDetalleHTML(): string {
      let html = '';
      for (const d of todosLosItems) {
        const acompNames = d.acompanamiento ? d.acompanamiento.split(',').map((n: string) => n.trim()).filter(Boolean) : [];
        const acompConRecargo = acompNames.filter((n: string) => getAcompRecargo(n) > 0);
        const acompSinRecargo = acompNames.filter((n: string) => getAcompRecargo(n) === 0);
        const baseSubtotal = d.subtotal - acompConRecargo.reduce((s: number, n: string) => s + getAcompRecargo(n) * (d.cantidad || 1), 0);
        html += `<div class="line"><span>${d.cantidad}x ${esc(d.nombre)}</span><span>$${baseSubtotal.toLocaleString('es-CL')}</span></div>`;
        for (const n of acompConRecargo) {
          html += `<div class="line" style="font-size:9px;padding-left:8px;"><span>+ ${esc(n)}</span><span>$${(getAcompRecargo(n) * (d.cantidad || 1)).toLocaleString('es-CL')}</span></div>`;
        }
        for (const n of acompSinRecargo) {
          html += `<div class="line" style="font-size:9px;padding-left:8px;color:#666;"><span>+ ${esc(n)}</span><span>—</span></div>`;
        }
      }
      return html;
    }

    const propMonto = propTipo === 'porcentaje' ? Math.round(subtotalGeneral * propAplicada / 100) : propAplicada;
    const totalFinal = Math.max(0, subtotalGeneral - descAplicado + propMonto);
    const vuelto = Math.max(0, montoPag - totalFinal);

    const fecha = new Date().toLocaleString('es-CL');

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Ticket La Cascada</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; padding: 6px 8px; max-width: 72mm; margin: 0 auto; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 5px 0; }
  .line { display: flex; justify-content: space-between; margin: 1px 0; }
  .total { font-size: 14px; }
  @media print { body { padding: 4px 6px; } }
</style></head><body>
  <div class="center bold" style="font-size:12px">LA CASCADA</div>
  <div class="center" style="font-size:9px">Restaurant &bull; Punto de Venta</div>
  <div class="divider"></div>
  <div class="line"><span>RUT:</span><span>13.384.575-5</span></div>
  <div class="line"><span>Tel:</span><span>+569 66937327</span></div>
  <div class="line"><span>Dir:</span><span>Rioseco #267, Lebu</span></div>
  <div class="divider"></div>
  <div class="line"><span>Fecha:</span><span>${fecha}</span></div>
  <div class="line"><span>Mesa:</span><span>Mesa ${String(mesa.numero_mesa).padStart(2, '0')} - Piso ${mesa.piso}</span></div>
  <div class="line"><span>Garzón:</span><span>${esc(garzones.find(g => String(g.id) === garzonId)?.nombre || '')}</span></div>
  <div class="line"><span>Comensales:</span><span>${comensales}</span></div>
  <div class="divider"></div>
  <div style="font-size:9px;margin-bottom:3px">DETALLE:</div>
  ${buildDetalleHTML()}
  <div class="divider"></div>
  <div class="line"><span>Subtotal:</span><span>$${subtotalGeneral.toLocaleString('es-CL')}</span></div>
  ${descAplicado > 0 ? `<div class="line"><span>Descuento:</span><span>-$${descAplicado.toLocaleString('es-CL')}</span></div>` : ''}
  ${propMonto > 0 ? `<div class="line"><span>Propina:</span><span>+$${propMonto.toLocaleString('es-CL')}</span></div>` : ''}
  <div class="divider"></div>
  <div class="line bold total"><span>TOTAL:</span><span>$${totalFinal.toLocaleString('es-CL')}</span></div>
  <div class="divider"></div>
  <div class="line"><span>Método:</span><span>${metodoStr}</span></div>
  <div class="line"><span>Pagado:</span><span>$${montoPag.toLocaleString('es-CL')}</span></div>
  <div class="line bold"><span>Vuelto:</span><span>$${vuelto.toLocaleString('es-CL')}</span></div>
  <div class="divider"></div>
  <div class="center" style="font-size:9px">¡Gracias por su visita!</div>
  <div class="center" style="font-size:8px;margin-top:3px">* Este comprobante es de uso interno</div>
  <script>window.onload=function(){window.print();}<` + `/script>
</body></html>`;

    const w = window.open('', '_blank', 'width=300,height=500');
    if (w) { w.document.write(html); w.document.close(); }
  }

  function formatMesa(): string {
    return `Mesa ${String(mesa.numero_mesa).padStart(2, '0')}`;
  }

  function formatCLP(n: number): string {
    return '$' + n.toLocaleString('es-CL');
  }
</script>

<!-- Overlay -->
<div class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" role="dialog">
  <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick={onclose}></div>

  {#if step === 'cargando'}
    <div class="relative bg-white rounded-2xl shadow-2xl z-10 px-10 py-14 flex flex-col items-center">
      <p class="text-2xl font-extrabold text-brand-700 mb-1">La Cascada</p>
      <p class="text-xs text-gray-400 mb-6">Sistema de Punto de Venta</p>
      <div class="flex gap-1.5 mb-4">
        <span class="w-2.5 h-2.5 rounded-full bg-brand-400 animate-pulse" style="animation-delay:0s"></span>
        <span class="w-2.5 h-2.5 rounded-full bg-brand-500 animate-pulse" style="animation-delay:0.2s"></span>
        <span class="w-2.5 h-2.5 rounded-full bg-brand-600 animate-pulse" style="animation-delay:0.4s"></span>
      </div>
      <p class="text-gray-400 text-xs tracking-widest uppercase">Cargando</p>
    </div>

  {:else if step === 'abrir'}
    <div class="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl z-10">
      <div class="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-gray-900">Abrir {formatMesa()}</h2>
          <button class="text-gray-400 hover:text-gray-600 text-xl" onclick={onclose}>&times;</button>
        </div>
      </div>
      <div class="p-6 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Garzón</label>
            <select class="input-field" bind:value={garzonId}>
              <option value="">Seleccionar garzón</option>
              {#each garzones as g}
                <option value={String(g.id)}>{g.nombre}</option>
              {/each}
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1.5">Comensales</label>
          <div class="flex items-center gap-3">
            <button class="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center" onclick={() => { if (comensales > 1) comensales-- }}>&minus;</button>
            <span class="text-2xl font-bold text-gray-900 w-12 text-center">{comensales}</span>
            <button class="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg flex items-center justify-center" onclick={() => { comensales++ }}>+</button>
          </div>
        </div>
        <div class="flex gap-3 pt-3">
          <button class="flex-1 btn-secondary py-3" onclick={onclose}>Cancelar</button>
          <button class="flex-1 btn-primary py-3 disabled:opacity-50" disabled={!garzonId || comensales < 1 || loading} onclick={abrirMesa}>Abrir Mesa</button>
        </div>
      </div>
    </div>

  {:else if step === 'orden'}
    <div class="relative bg-gray-50 rounded-2xl w-full max-w-6xl h-[90vh] overflow-hidden shadow-2xl z-10 flex flex-col">
      <!-- Top Bar -->
      <div class="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div class="flex items-center gap-4">
          <button class="text-gray-400 hover:text-gray-600" onclick={() => { pedidosInfo.length > 0 ? volverAEditar() : step = 'abrir' }}>
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h2 class="text-lg font-bold text-gray-900">{formatMesa()}</h2>
            <p class="text-xs text-gray-500">{comensales} comensal{comensales !== 1 ? 'es' : ''}</p>
          </div>
          {#if comensalesList[activeComensal]?.comentarios}
            <span class="text-xs text-gray-400 italic hidden sm:inline">"{comensalesList[activeComensal].comentarios}"</span>
          {/if}
        </div>
        <div class="flex items-center gap-3">
          {#if pedidosInfo.length === 0}
            <div class="flex-1 space-y-2">
              <textarea class="input-field h-16 resize-none text-xs w-full" placeholder="Comentarios del pedido (ej: sin cebolla, alérgico a...)" bind:value={comensalesList[activeComensal].comentarios}></textarea>
              <div class="flex items-center gap-3">
                <div class="text-right">
                  <p class="text-xs text-gray-500">Total</p>
                  <p class="text-lg font-bold text-brand-700">{formatCLP(getSubtotalGlobal())}</p>
                </div>
                <button class="btn-primary px-5 py-2 disabled:opacity-50" disabled={!hasItems() || saving} onclick={confirmarPedido}>
                  {saving ? '...' : 'Confirmar Pedido'}
                </button>
              </div>
            </div>
          {:else if !todosPagados()}
            <span class="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium">{pedidosRestantes()} pendiente{pedidosRestantes() !== 1 ? 's' : ''}</span>
          {:else}
            <span class="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">Todo pagado</span>
          {/if}
        </div>
      </div>

      {#if pedidosInfo.length === 0}
        <!-- ===== ORDER MODE ===== -->
        <div class="bg-white border-b border-gray-100 px-4 py-2 shrink-0">
          <div class="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {#each comensalesList as c, idx}
              <button
                class="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5
                  {activeComensal === idx ? 'bg-brand-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
                onclick={() => { activeComensal = idx }}
              >
                {c.label}
                {#if getComensalTotal(idx) > 0}
                  <span class="opacity-80">{formatCLP(getComensalTotal(idx))}</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <div class="flex-1 overflow-hidden flex flex-col sm:flex-row">
          <div class="flex-1 overflow-y-auto p-4 sm:p-6">
            <nav class="flex gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-hide">
              {#each grupos as grupo}
                <button class="px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors {activeGrupo === grupo.id ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-300'}" onclick={() => { activeGrupo = grupo.id }}>{grupo.label}</button>
              {/each}
            </nav>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {#each getProductosGrupo(activeGrupo) as prod (prod.id)}
                <button class="text-left bg-white rounded-xl p-3 border border-gray-100 hover:shadow-md hover:border-brand-200 transition-all cursor-pointer" onclick={() => addProducto(prod)}>
                  <div class="flex justify-between items-start">
                    <div class="flex-1 pr-2">
                      <p class="font-semibold text-gray-900 text-sm">{prod.nombre}</p>
                      {#if prod.ingredientes}<p class="text-xs text-gray-400 mt-0.5 line-clamp-2">{prod.ingredientes}</p>{/if}
                      {#if prod.maneja_stock && prod.stock_actual <= 5}
                        <p class="text-xs mt-1 font-medium {prod.stock_actual === 0 ? 'text-red-500' : 'text-amber-600'}">{prod.stock_actual === 0 ? 'Agotado' : `Solo ${prod.stock_actual} disp.`}</p>
                      {/if}
                    </div>
                    <span class="text-brand-700 font-bold text-sm whitespace-nowrap">{formatCLP(prod.precio)}</span>
                  </div>
                </button>
              {/each}
            </div>
            {#if getProductosGrupo(activeGrupo).length === 0}
              <p class="text-center text-gray-400 py-10">Sin productos en esta categoría</p>
            {/if}
          </div>

          <div class="w-full sm:w-80 bg-white border-t sm:border-t-0 sm:border-l border-gray-200 flex flex-col shrink-0 sm:max-h-full max-h-[40vh]">
            <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 class="font-semibold text-gray-900 text-sm">{comensalesList[activeComensal]?.label || ''}</h3>
              <span class="text-sm font-bold text-brand-700">{formatCLP(getComensalTotal(activeComensal))}</span>
            </div>
            <div class="flex-1 overflow-y-auto p-4">
              {#if getActiveItems().length === 0}
                <p class="text-gray-400 text-sm text-center py-8">Selecciona productos</p>
              {:else}
                <div class="space-y-2">
                  {#each getActiveItems() as item (item.id)}
                    <div class="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">{item.producto.nombre}</p>
                        {#if item.acompanamiento && item.acompanamiento !== 'Sin acompañamiento'}
                          <p class="text-xs text-gray-400">{item.acompanamiento}</p>
                        {/if}
                        <div class="flex items-center gap-2 mt-1">
                          <button class="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs flex items-center justify-center" onclick={() => updateCantidad(item.id, -1)}>&minus;</button>
                          <span class="text-xs font-semibold w-5 text-center">{item.cantidad}</span>
                          <button class="w-5 h-5 rounded bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs flex items-center justify-center" onclick={() => updateCantidad(item.id, 1)}>+</button>
                        </div>
                      </div>
                      <div class="text-right">
                        <p class="text-sm font-bold text-gray-900">{formatCLP(item.subtotal || item.producto.precio * item.cantidad)}</p>
                        <button class="text-xs text-red-400 hover:text-red-600 mt-0.5" onclick={() => removeItem(item.id)}>Quitar</button>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>

      {:else}
        <!-- ===== PAYMENT MODE ===== -->
        <div class="flex-1 overflow-hidden flex flex-col sm:flex-row">
          <!-- LEFT: Resumen del Pedido -->
          <div class="flex-1 overflow-y-auto p-4 sm:p-6 bg-white">
            <h3 class="font-semibold text-gray-900 text-sm mb-3">Resumen del Pedido</h3>
            {#if comensalesList.some(c => c.items.length > 0)}
            <div class="space-y-4">
              {#each comensalesList as c (c.id)}
                {#if c.items.length > 0}
                  {@const idx = c.id - 1}
                  {@const pagado = comensalPagado(idx)}
                  <div class="border border-gray-100 rounded-xl p-3 {pagado ? 'bg-green-50/50 border-green-200' : ''}">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full {pagado ? 'bg-green-500' : 'bg-amber-400'}"></span>
                        <span class="text-sm font-semibold text-gray-900">{c.label}</span>
                        <span class="text-xs text-gray-400">({getComensalItemsCount(idx)} items)</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-gray-900 text-sm">{formatCLP(getComensalTotal(idx))}</span>
                        {#if pagado}
                          <span class="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">Pagado</span>
                        {:else}
                          <span class="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">Pendiente</span>
                        {/if}
                      </div>
                    </div>
                    <div class="space-y-1">
                      {#each c.items as item (item.id)}
                        <div class="flex justify-between text-xs pl-4">
                          <span class="text-gray-500">{item.cantidad}x {item.producto.nombre}{#if item.acompanamiento && item.acompanamiento !== 'Sin acompañamiento'} <span class="text-gray-400">({item.acompanamiento})</span>{/if}</span>
                          <span class="text-gray-600">{formatCLP(item.subtotal || item.producto.precio * item.cantidad)}</span>
                        </div>
                      {/each}
                    </div>
                    {#if pagado}
                      {@const pi = pedidosInfo.find(p => p.comensalIdx === idx)}
                      {#if pi?.voucher}
                        <button class="mt-2 text-xs text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1" onclick={() => imprimirTicket(pi)}>
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                          Imprimir Ticket
                        </button>
                      {/if}
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>
            {:else if pedidosInfo.length > 0}
            <div class="space-y-3">
              <p class="text-xs text-gray-500">Pedidos activos de esta mesa:</p>
              {#each pedidosInfo as p}
                <div class="border border-gray-100 rounded-xl p-3 {p.pagado ? 'bg-green-50/50 border-green-200' : ''}">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full {p.pagado ? 'bg-green-500' : 'bg-amber-400'}"></span>
                      <span class="text-sm font-semibold text-gray-900">Pedido #{p.pedidoId}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      {#if p.pagado}
                        <span class="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">Pagado</span>
                      {:else}
                        <span class="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">Pendiente</span>
                      {/if}
                    </div>
                  </div>
                  {#if p.voucher}
                    <button class="mt-2 text-xs text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1" onclick={() => imprimirTicket(p)}>
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                      Imprimir Ticket
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
            {:else}
            <p class="text-gray-400 text-sm text-center py-8">No hay pedidos registrados</p>
            {/if}
            <div class="mt-4 pt-3 border-t border-gray-200 flex justify-between">
              <span class="font-bold text-gray-900">Consumo Total</span>
              <span class="font-bold text-brand-700 text-lg">{formatCLP(getSubtotalGlobal())}</span>
            </div>
          </div>

          <!-- RIGHT: Payment Form -->
          <div class="w-full sm:w-80 bg-gray-50 border-t sm:border-t-0 sm:border-l border-gray-200 flex flex-col shrink-0 overflow-y-auto sm:max-h-full max-h-[45vh]">
            {#if todosPagados()}
              <div class="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <svg class="w-16 h-16 text-green-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p class="text-lg font-bold text-gray-900 mb-1">Todo Pagado</p>
                <p class="text-sm text-gray-500 mb-6">Todos los comensales han pagado</p>
                <button class="w-full py-2 mb-2 rounded-lg border border-brand-300 text-brand-700 font-semibold text-sm hover:bg-brand-50 transition-colors flex items-center justify-center gap-2" onclick={imprimirTicketGeneral}>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                  Imprimir Ticket General
                </button>
                <button class="btn-primary w-full py-2" onclick={onclose}>Cerrar Mesa</button>
              </div>
            {:else}
            <div class="px-4 py-3 border-b border-gray-200">
              <h3 class="font-semibold text-gray-900 text-sm">Realizar Pago</h3>
            </div>

            <div class="p-4 space-y-3">
              <!-- Quién paga -->
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1.5">¿Quién paga?</label>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    class="text-xs px-3 py-1.5 rounded-full border transition-colors
                      {pagoComensalIdx === -1 ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}"
                    onclick={() => { pagoComensalIdx = -1; descuento = 0 }}
                  >Todos ({formatCLP(getSubtotalPendiente())})</button>
                  {#if comensalesList.some(c => c.items.length > 0)}
                    {#each comensalesList as c (c.id)}
                      {#if c.items.length > 0 && !comensalPagado(c.id - 1)}
                        <button
                          class="text-xs px-3 py-1.5 rounded-full border transition-colors
                            {pagoComensalIdx === c.id - 1 ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}"
                          onclick={() => { pagoComensalIdx = c.id - 1; descuento = 0 }}
                        >{c.label} ({formatCLP(getComensalTotal(c.id - 1))})</button>
                      {/if}
                    {/each}
                  {:else}
                    {#each pedidosInfo.filter(p => !p.pagado) as p}
                      <button
                        class="text-xs px-3 py-1.5 rounded-full border transition-colors
                          {pagoComensalIdx === p.pedidoId ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}"
                        onclick={() => { pagoComensalIdx = p.pedidoId; descuento = 0 }}
                      >Pedido #{p.pedidoId}</button>
                    {/each}
                  {/if}
                </div>
              </div>

              <!-- Subtotal a pagar -->
              {#if pagoComensalIdx === -1}
                <div class="flex justify-between text-sm bg-white rounded-lg p-2">
                  <span class="text-gray-600">Subtotal pendiente</span>
                  <span class="font-bold text-gray-900">{formatCLP(getSubtotalPendiente())}</span>
                </div>
              {:else}
                <div class="flex justify-between text-sm bg-white rounded-lg p-2">
                  <span class="text-gray-600">{comensalesList[pagoComensalIdx]?.label}</span>
                  <span class="font-bold text-gray-900">{formatCLP(getComensalTotal(pagoComensalIdx))}</span>
                </div>
              {/if}

              <!-- Descuento -->
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">Descuento</label>
                <div class="flex items-center gap-2">
                  <span class="text-gray-400 text-sm">$</span>
                  <input type="number" class="input-field text-sm" min="0" bind:value={descuento} placeholder="0" />
                </div>
              </div>

              <!-- Total a Pagar -->
              <div class="flex justify-between items-center pt-2 border-t border-gray-200 bg-white rounded-lg p-2">
                <span class="text-sm font-bold text-gray-900">Total a Pagar</span>
                <span class="text-lg font-bold text-brand-700">{formatCLP(getTotalFinal())}</span>
              </div>

              <!-- Monto Pagado + Vuelto -->
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">Monto con que paga</label>
                <div class="flex items-center gap-2">
                  <span class="text-gray-400 text-sm">$</span>
                  <input type="number" class="input-field text-sm" min="0" bind:value={montoPagado} placeholder="0" />
                </div>
                {#if montoPagado > getTotalFinal()}
                  <p class="text-xs text-green-600 font-semibold mt-1">Vuelto: {formatCLP(montoPagado - getTotalFinal())}</p>
                {/if}
              </div>

              <!-- Método de pago -->
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">Método de Pago</label>
                <div class="grid grid-cols-2 gap-1.5">
                  {#each metodosPago as m}
                    <button class="text-xs px-2 py-2 rounded-lg border transition-colors {metodoPago === m.id ? 'border-brand-500 bg-brand-50 text-brand-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}" onclick={() => { metodoPago = m.id }}>{m.label}</button>
                  {/each}
                </div>
              </div>

              <button class="btn-primary w-full py-3 disabled:opacity-50" disabled={saving || getTotalFinal() <= 0 || (metodoPago === 'efectivo' && montoPagado < getTotalFinal())} onclick={realizarPago}>
                {saving ? 'Procesando...' : pagoComensalIdx === -1 ? 'Pagar Todo' : `Pagar ${comensalesList[pagoComensalIdx]?.label || ''}`}
              </button>
              {#if metodoPago === 'efectivo' && montoPagado > 0 && montoPagado < getTotalFinal()}
                <p class="text-xs text-red-500 font-semibold text-center">El monto ingresado es menor al total a pagar</p>
              {/if}
              <button class="w-full py-2 rounded-lg border border-gray-300 text-gray-600 font-medium text-sm hover:bg-gray-100 transition-colors" onclick={volverAEditar}>
                ← Volver a editar pedido
              </button>
              <button class="w-full py-2 rounded-lg border border-brand-300 text-brand-700 font-semibold text-sm hover:bg-brand-50 transition-colors" onclick={volverAlMenu}>
                Volver al menú principal
              </button>
            </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Acomp Modal -->
{#if showAcompModal && acompProducto}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick={closeAcompModal}></div>
    <div class="relative w-full sm:max-w-md max-h-[80vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-6 z-10 shadow-2xl bg-white">
      <div class="flex items-center gap-4 mb-5">
        <div>
          <h3 class="font-semibold text-lg text-gray-900">{acompProducto.nombre}</h3>
          <p class="text-brand-700 font-bold">{formatCLP(acompProducto.precio)}</p>
        </div>
      </div>
      {#if getAcompForProducto(acompProducto.id).length > 0}
        <div class="mb-4">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Acompañamientos (máx. 2) {#if selectedAcomps.length === 0}<span class="text-red-400 font-normal normal-case">— Sin acompañamiento</span>{/if}</p>
          <div class="space-y-2">
            {#each getAcompForProducto(acompProducto.id) as acomp (acomp.id)}
              {@const disabled = selectedAcomps.length >= 2 && !selectedAcomps.includes(acomp.id)}
              <label class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all {selectedAcomps.includes(acomp.id) ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300'} {disabled ? 'opacity-40 pointer-events-none' : ''}">
                <input type="checkbox" checked={selectedAcomps.includes(acomp.id)} disabled={disabled} onchange={(e) => { if (e.target.checked) selectedAcomps = [...selectedAcomps, acomp.id]; else selectedAcomps = selectedAcomps.filter(id => id !== acomp.id); }} style="accent-color:#c9a227;" />
                <span class="flex-1 text-sm font-medium text-gray-800">{acomp.nombre}</span>
                {#if acomp.recargo > 0}<span class="text-sm text-brand-700 font-bold">+{formatCLP(acomp.recargo)}</span>{/if}
              </label>
            {/each}
          </div>
        </div>
      {/if}
      <button class="w-full py-3.5 rounded-xl text-white font-semibold transition-all text-base bg-brand-600 hover:bg-brand-700" onclick={confirmarAcomp}>Agregar al pedido</button>
    </div>
  </div>
{/if}

<style>
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
</style>
