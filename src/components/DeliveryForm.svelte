<script lang="ts">
  import type { Categoria, Producto, Acompanamiento, ProductoAcompanamiento } from '../lib/types';

  let { menuData } = $props<{ menuData: any }>();

  let step: string = $state('menu');
  let nombre: string = $state(''); let direccion: string = $state(''); let telefono: string = $state('');
  let metodoPago: string = $state('efectivo'); let efectivoConCuanto: number = $state(0);
  let submitting: boolean = $state(false); let orderSuccess: boolean = $state(false); let orderError: string = $state('');
  let pedidoId: number | null = $state(null); let vuelto: number = $state(0);
  let showAcompModal: boolean = $state(false); let selectedProduct: Producto | null = $state(null);
  let selectedBaseAcomp: number = $state(0); let selectedExtras: number[] = $state([]);

  let categorias = $state.raw(menuData?.categorias || []); let productos = $state.raw(menuData?.productos || []);
  let acompanamientos = $state.raw(menuData?.acompanamientos || []); let productosAcomp = $state.raw(menuData?.productos_acompanamientos || []);
  let activeCategoria = $state.raw(categorias[0]?.id || 0); let cart: CartItem[] = $state([]);

  const CAT_ICONS: Record<string, string> = { 'Colaciones':'🍛','Extras':'🍟','Completos':'🌭','Sandwichs':'🥪','Bebidas':'🥤','Té':'🍵','Cafés':'☕','Alcoholes':'🍺' };
  function catIcon(n: string) { return CAT_ICONS[n] || '📋'; }

  interface CartItem { id: string; producto: Producto; cantidad: number; acompanamiento: string; subtotal: number; }

  function getFiltered(): Producto[] { return productos.filter(p => p.categoria_id === activeCategoria); }
  function getBase(pId: number) { const ids = productosAcomp.filter(pa => pa.producto_id === pId).map(pa => pa.acompanamiento_id); return acompanamientos.filter(a => ids.includes(a.id) && !a.es_extra); }
  function getExtra(pId: number) { const ids = productosAcomp.filter(pa => pa.producto_id === pId).map(pa => pa.acompanamiento_id); return acompanamientos.filter(a => ids.includes(a.id) && a.es_extra); }
  function getTotal() { return cart.reduce((s, i) => s + i.subtotal, 0); }

  function clickProducto(p: Producto) { selectedProduct = p; selectedBaseAcomp = 0; selectedExtras = []; const b = getBase(p.id); if (b.length === 1) selectedBaseAcomp = b[0].id; if (b.length > 0 || getExtra(p.id).length > 0) showAcompModal = true; else addSimple(); }
  function closeModal() { showAcompModal = false; selectedProduct = null; }
  function addSimple() { if (!selectedProduct) return; cart = [...cart, { id: crypto.randomUUID?.() ?? Math.random().toString(36).substring(2), producto: selectedProduct, cantidad: 1, acompanamiento: 'Sin acompañamiento', subtotal: selectedProduct.precio }]; closeModal(); }
  function addToCart() { if (!selectedProduct) return; let ep = 0; const en: string[] = []; for (const id of selectedExtras) { const e = acompanamientos.find(a => a.id === id); if (e) { ep += e.recargo; en.push(e.nombre); } } const b = acompanamientos.find(a => a.id === selectedBaseAcomp); const name = [b?.nombre, ...en].filter(Boolean).join(' + ') || 'Sin acompañamiento'; cart = [...cart, { id: crypto.randomUUID?.() ?? Math.random().toString(36).substring(2), producto: selectedProduct, cantidad: 1, acompanamiento: name, subtotal: selectedProduct.precio + ep }]; closeModal(); }
  function remove(id: string) { cart = cart.filter(i => i.id !== id); }
  function goCheckout() { if (cart.length === 0) return; step = 'datos'; efectivoConCuanto = getTotal(); }
  function back() { step = 'menu'; }

  async function submitOrder() {
    if (!nombre.trim() || !direccion.trim() || !telefono.trim()) { orderError = 'Todos los campos son obligatorios'; return; }
    if (metodoPago === 'efectivo' && efectivoConCuanto < getTotal()) { orderError = `El monto debe cubrir el total (${formatCLP(getTotal())})`; return; }
    submitting = true; orderError = '';
    try {
      const res = await fetch('/api/delivery/pedido', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nombre.trim(), direccion: direccion.trim(), telefono: telefono.trim(), metodo_pago: metodoPago, efectivo_con_cuanto: metodoPago === 'efectivo' ? efectivoConCuanto : 0, items: cart.map(i => ({ producto_id: i.producto.id, acompanamiento: i.acompanamiento, cantidad: i.cantidad, subtotal: i.subtotal })), total: getTotal() }) });
      const d = await res.json();
      if (res.ok) { orderSuccess = true; pedidoId = d.pedido_id; vuelto = d.vuelto || 0; step = 'exito'; } else { orderError = d.error || 'Error al crear el pedido'; }
    } catch { orderError = 'Error de conexión.'; }
    finally { submitting = false; }
  }

  function nuevoPedido() { cart = []; nombre = ''; direccion = ''; telefono = ''; metodoPago = 'efectivo'; efectivoConCuanto = 0; orderSuccess = false; orderError = ''; pedidoId = null; vuelto = 0; step = 'menu'; }
  function formatCLP(n: number) { return '$' + n.toLocaleString('es-CL'); }

  function handleTelefonoInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    let val = input.value.replace(/\D/g, '');
    if (!val.startsWith('569')) val = '569' + val.replace(/^569/, '');
    val = val.slice(0, 11);
    telefono = '+569 ' + val.slice(3);
  }
</script>

<div class="min-h-screen" style="background-color:#faf6f0; color:#2d2418;">

  <!-- Header -->
  <header class="sticky top-0 z-30 border-b" style="background-color: rgba(250,246,240,0.92); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-color: #e8e0d0;">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style="background-color: #c9a227;">LC</div>
        <div>
          <h1 class="font-display text-lg font-semibold leading-none" style="color: #1a1410;">La Cascada</h1>
          <p class="text-[11px] tracking-wider uppercase" style="color: #6b5d4f;">Delivery</p>
        </div>
      </div>
      {#if step === 'menu' && cart.length > 0}
        <button class="px-5 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2" style="background-color:#c9a227; color:#1a1410;" onclick={goCheckout}>🛒 {cart.length} · {formatCLP(getTotal())}</button>
      {/if}
    </div>
  </header>

  <div class="max-w-5xl mx-auto px-4 sm:px-6 pb-32">
    <!-- STEP: MENU -->
    {#if step === 'menu'}
      <div class="pt-8 pb-6">
        <p class="text-[#6b5d4f] text-xs tracking-[0.2em] uppercase mb-2">Delivery a domicilio</p>
        <h2 class="font-display text-3xl md:text-4xl text-[#1a1410] font-bold leading-tight">Pedí desde casa</h2>
        <p class="text-[#6b5d4f] text-sm mt-2 max-w-lg leading-relaxed">Elegí tus platos favoritos y te los llevamos. Llená tus datos al finalizar.</p>
      </div>

      <nav class="flex gap-2 overflow-x-auto pb-1 mb-4 sm:mb-8 sticky top-[57px] z-20 pt-2 scrollbar-hide" style="background: linear-gradient(to bottom, #faf6f0 60%, transparent);">
        {#each categorias as cat (cat.id)}
          <button class="shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border" style="{activeCategoria === cat.id ? 'background-color:#1a1410; color:#fff; border-color:#1a1410;' : 'background-color:#fff; color:#6b5d4f; border-color:#e8e0d0;'}" onclick={() => { activeCategoria = cat.id }}><span class="mr-1">{catIcon(cat.nombre)}</span> {cat.nombre}</button>
        {/each}
      </nav>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {#each getFiltered() as producto (producto.id)}
          <button class="text-left rounded-xl p-5 transition-all duration-300 w-full group border" style="background-color:#fff; border-color:#e8e0d0;" onmouseenter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#c9a227'; el.style.boxShadow = '0 4px 24px rgba(201,162,39,0.1)'; }} onmouseleave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#e8e0d0'; el.style.boxShadow = 'none'; }} onclick={() => clickProducto(producto)}>
            <div class="flex justify-between items-start gap-4">
              <div class="flex-1 min-w-0"><h3 class="font-semibold text-[#1a1410] text-base group-hover:text-[#c9a227] transition-colors leading-snug">{producto.nombre}</h3>{#if producto.ingredientes}<p class="text-[#6b5d4f] text-xs leading-relaxed mt-1 line-clamp-2">{producto.ingredientes}</p>{/if}</div>
              <div class="text-right shrink-0"><span class="font-bold text-[#1a1410] text-base">{formatCLP(producto.precio)}</span>{#if producto.maneja_stock}<p class="text-[11px] text-[#6b5d4f] mt-0.5">{producto.stock_actual} disp.</p>{/if}</div>
            </div>
          </button>
        {/each}
      </div>
      {#if getFiltered().length === 0}<div class="text-center py-20"><p class="text-4xl mb-3 opacity-30">📭</p><p class="text-[#6b5d4f]">No hay productos en esta categoría</p></div>{/if}

    <!-- STEP: DATOS -->
    {:else if step === 'datos'}
      <div class="max-w-md mx-auto pt-8">
        <button class="text-[#c9a227] text-sm mb-8 flex items-center gap-1.5 font-medium hover:underline" onclick={back}>← Volver al menú</button>
        <div class="rounded-2xl p-6 sm:p-8 shadow-lg border" style="background-color:#fff; border-color:#e8e0d0;">
          <h2 class="font-display text-2xl text-[#1a1410] font-bold mb-1">Tus datos</h2>
          <p class="text-[#6b5d4f] text-sm mb-6">Completá para recibir tu pedido</p>

          <div class="space-y-4 mb-6">
            <div><label class="block text-xs font-semibold text-[#1a1410] uppercase tracking-wider mb-1.5">Nombre</label><input type="text" bind:value={nombre} placeholder="Tu nombre completo" class="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all" style="border-color:#e8e0d0; background-color:#faf6f0;" onfocus={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#c9a227'; }} onblur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#e8e0d0'; }} /></div>
            <div><label class="block text-xs font-semibold text-[#1a1410] uppercase tracking-wider mb-1.5">Dirección</label><input type="text" bind:value={direccion} placeholder="Calle, número, depto" class="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all" style="border-color:#e8e0d0; background-color:#faf6f0;" onfocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#c9a227'; }} onblur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#e8e0d0'; }} /></div>
            <div><label class="block text-xs font-semibold text-[#1a1410] uppercase tracking-wider mb-1.5">Teléfono</label><input type="tel" value={telefono} oninput={handleTelefonoInput} placeholder="+569 XXXXXXXX" maxlength="14" class="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all" style="border-color:#e8e0d0; background-color:#faf6f0;" onfocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#c9a227'; }} onblur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#e8e0d0'; }} /></div>
            <div>
              <label class="block text-xs font-semibold text-[#1a1410] uppercase tracking-wider mb-2">Método de pago</label>
              <div class="grid grid-cols-3 gap-2">
                {#each ['efectivo', 'debito', 'credito'] as m}
                  <label class="flex items-center justify-center gap-1 p-3 rounded-xl border-2 cursor-pointer text-sm transition-all" style="{metodoPago === m ? 'border-color:#c9a227; background-color:#faf6f0; color:#1a1410; font-weight:600;' : 'border-color:#e8e0d0; color:#6b5d4f;'}"><input type="radio" bind:group={metodoPago} value={m} class="sr-only" /><span>{m === 'efectivo' ? '💵 Efectivo' : m === 'debito' ? '💳 Débito' : '💳 Crédito'}</span></label>
                {/each}
              </div>
            </div>
            {#if metodoPago === 'efectivo'}
              <div><label class="block text-xs font-semibold text-[#1a1410] uppercase tracking-wider mb-1.5">¿Con cuánto cancela?</label><input type="number" bind:value={efectivoConCuanto} min={getTotal()} class="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all" style="border-color:#e8e0d0; background-color:#faf6f0;" /><div>{#if efectivoConCuanto > getTotal()}<p class="text-sm font-medium mt-1.5" style="color:#16a34a;">Vuelto: {formatCLP(efectivoConCuanto - getTotal())}</p>{/if}</div></div>
            {/if}
          </div>

          <div class="rounded-xl p-4 mb-6" style="background-color:#faf6f0;">
            <h3 class="font-semibold text-[#1a1410] mb-3 text-sm uppercase tracking-wider">Resumen</h3>
            <div class="space-y-2 mb-3">
              {#each cart as item (item.id)}
                <div class="flex justify-between text-sm"><span class="text-[#2d2418]">{item.cantidad}x {item.producto.nombre}</span><span class="font-semibold text-[#1a1410]">{formatCLP(item.subtotal)}</span></div>
                {#if item.acompanamiento && item.acompanamiento !== 'Sin acompañamiento'}<p class="text-xs opacity-50 ml-4">+ {item.acompanamiento}</p>{/if}
              {/each}
            </div>
            <div class="border-t pt-3 flex justify-between items-center" style="border-color:#e8e0d0;"><span class="font-bold text-[#1a1410]">Total</span><span class="text-xl font-bold" style="color:#c9a227;">{formatCLP(getTotal())}</span></div>
          </div>

          {#if orderError}<div class="rounded-xl p-3 mb-4 text-sm font-medium" style="background-color:#fef2f2; color:#dc2626; border:1px solid #fecaca;">{orderError}</div>{/if}

          <button class="w-full py-3.5 rounded-xl text-white font-bold text-lg transition-all shadow-lg" style="background-color:#c9a227;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#b8922a'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#c9a227'; }} onclick={submitOrder} disabled={submitting}>{submitting ? 'Enviando...' : `Confirmar · ${formatCLP(getTotal())}`}</button>
        </div>
      </div>

    <!-- STEP: ÉXITO -->
    {:else if step === 'exito'}
      <div class="max-w-md mx-auto pt-12 text-center">
        <div class="rounded-3xl p-8 sm:p-10 shadow-lg border animate-fade-in" style="background-color:#fff; border-color:#e8e0d0;">
          <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style="background-color:#f0fdf4;"><span class="text-3xl">✅</span></div>
          <h2 class="font-display text-2xl text-[#1a1410] font-bold mb-2">¡Pedido recibido!</h2>
          <p class="text-[#6b5d4f] mb-1">Pedido <span class="font-bold text-[#c9a227] text-lg">#{pedidoId}</span></p>
          {#if metodoPago === 'efectivo' && vuelto > 0}<p class="text-sm font-medium mt-2" style="color:#16a34a;">Vuelto: {formatCLP(vuelto)}</p>{/if}
          <p class="text-[#6b5d4f] text-sm mt-6 leading-relaxed">Te llamaremos al <span class="font-semibold text-[#1a1410]">{telefono}</span> cuando esté listo para despacho.</p>
          <button class="w-full py-3.5 rounded-xl text-white font-bold mt-8 transition-all" style="background-color:#c9a227;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#b8922a'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#c9a227'; }} onclick={nuevoPedido}>Hacer otro pedido</button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <footer class="border-t py-10 px-4 mt-8" style="border-color:#e8e0d0; background-color:#fff;">
    <div class="max-w-5xl mx-auto text-center">
      <p class="font-display text-xl text-[#c9a227] font-bold">La Cascada</p>
      <p class="text-[#6b5d4f] text-xs mt-1">Delivery &bull; Rioseco #267, Lebu</p>
      <p class="text-[#6b5d4f] text-xs">+569 66937327</p>
    </div>
  </footer>
</div>

<!-- Acomp Modal -->
{#if showAcompModal && selectedProduct}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick={closeModal}></div>
    <div class="relative w-full sm:max-w-md max-h-[80vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-6 z-10 shadow-2xl animate-slide-up" style="background-color:#fff;">
      <div class="flex items-center gap-4 mb-5"><span class="text-3xl">{catIcon(selectedProduct.categoria_nombre || '')}</span><div><h3 class="font-semibold text-lg text-[#1a1410]">{selectedProduct.nombre}</h3><p class="text-[#c9a227] font-bold">{formatCLP(selectedProduct.precio)}</p></div></div>
      {#if getBase(selectedProduct.id).length > 0}
        <div class="mb-4"><p class="text-xs font-semibold text-[#6b5d4f] uppercase tracking-wider mb-2">Acompañamiento</p>
          <div class="space-y-2">
            <label class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all {selectedBaseAcomp === 0 ? 'border-[#c9a227] bg-[#faf6f0]' : 'border-[#e8e0d0] hover:border-[#c9a227]/50'}"><input type="radio" name="ba" value="0" checked={selectedBaseAcomp === 0} onchange={() => { selectedBaseAcomp = 0 }} style="accent-color:#c9a227;" /><span class="flex-1 text-sm font-medium text-[#2d2418]">Sin acompañamiento</span></label>
            {#each getBase(selectedProduct.id) as acomp (acomp.id)}<label class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all {selectedBaseAcomp === acomp.id ? 'border-[#c9a227] bg-[#faf6f0]' : 'border-[#e8e0d0] hover:border-[#c9a227]/50'}"><input type="radio" name="ba" value={acomp.id} checked={selectedBaseAcomp === acomp.id} onchange={() => { selectedBaseAcomp = acomp.id }} style="accent-color:#c9a227;" /><span class="flex-1 text-sm font-medium text-[#2d2418]">{acomp.nombre}</span></label>{/each}</div></div>
      {/if}
      {#if getExtra(selectedProduct.id).length > 0}
        <div class="mb-4"><p class="text-xs font-semibold text-[#6b5d4f] uppercase tracking-wider mb-2">Extras</p>
          <div class="space-y-2">{#each getExtra(selectedProduct.id) as extra (extra.id)}<label class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all {selectedExtras.includes(extra.id) ? 'border-[#c9a227] bg-[#faf6f0]' : 'border-[#e8e0d0] hover:border-[#c9a227]/50'}"><input type="checkbox" checked={selectedExtras.includes(extra.id)} onchange={(e) => { if (e.target.checked) selectedExtras = [...selectedExtras, extra.id]; else selectedExtras = selectedExtras.filter(id => id !== extra.id); }} style="accent-color:#c9a227;" /><span class="flex-1 text-sm font-medium text-[#2d2418]">{extra.nombre}</span><span class="text-sm text-[#c9a227] font-bold">+{formatCLP(extra.recargo)}</span></label>{/each}</div></div>
      {/if}
      <button class="w-full py-3.5 rounded-xl text-white font-semibold transition-all text-base" style="background-color:#c9a227;" onclick={addToCart}>Agregar al pedido</button>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
  @keyframes slide-up { 0% { opacity: 0; transform: translateY(30px); } 100% { opacity: 1; transform: translateY(0); } }
  .animate-fade-in { animation: fade-in 0.6s ease-out forwards; }
  .animate-slide-up { animation: slide-up 0.4s ease-out forwards; }
  .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .font-display { font-family: 'Playfair Display', Georgia, serif; }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
