<script lang="ts">
  import type { Categoria, Producto, Acompanamiento, ProductoAcompanamiento } from '../lib/types';

  let { menuData } = $props<{ menuData: any }>();

  let step: string = $state('menu');
  let modo: string = $state('delivery'); let zona: string = $state(''); const costoZonas: Record<string, number> = { 'Lebu Norte': 2000, 'Lebu Centro': 1500 };
  let nombre: string = $state(''); let direccion: string = $state(''); let telefono: string = $state('');
  let metodoPago: string = $state('efectivo'); let efectivoConCuanto: number = $state(0);
  let submitting: boolean = $state(false); let orderSuccess: boolean = $state(false); let orderError: string = $state('');
  let pedidoId: number | null = $state(null); let vuelto: number = $state(0);
  let showAcompModal: boolean = $state(false); let selectedProduct: Producto | null = $state(null);
  let selectedAcomps: number[] = $state([]);
  let confirmStep: boolean = $state(false);

  let categorias = $state.raw(menuData?.categorias || []); let productos = $state.raw(menuData?.productos || []);
  let acompanamientos = $state.raw(menuData?.acompanamientos || []); let productosAcomp = $state.raw(menuData?.productos_acompanamientos || []);
  let activeCategoria = $state.raw(categorias[0]?.id || 0); let cart: CartItem[] = $state([]);

  const CAT_ICONS: Record<string, string> = { 'Colaciones':'🍛','Extras':'🍟','Completos':'🌭','Sandwichs':'🥪','Bebidas':'🥤','Té':'🍵','Cafés':'☕','Alcoholes':'🍺' };
  function catIcon(n: string) { return CAT_ICONS[n] || '📋'; }

  interface CartItem { id: string; producto: Producto; cantidad: number; acompanamiento: string; subtotal: number; }

  function getFiltered(): Producto[] { return productos.filter(p => p.categoria_id === activeCategoria); }
  function getAcomps(pId: number) { const ids = productosAcomp.filter(pa => pa.producto_id === pId).map(pa => pa.acompanamiento_id); return acompanamientos.filter(a => ids.includes(a.id)); }
  function getSubtotalProductos() { return cart.reduce((s, i) => s + i.subtotal, 0); }
  function getCostoEnvio() { return modo === 'delivery' ? (costoZonas[zona] || 0) : 0; }
  function getTotal() { return getSubtotalProductos() + getCostoEnvio(); }

  function clickProducto(p: Producto) { selectedProduct = p; selectedAcomps = []; confirmStep = false; showAcompModal = true; }
  function closeModal() { showAcompModal = false; selectedProduct = null; confirmStep = false; }
  function prepararAddToCart() { confirmStep = true; }
  function confirmarYAgregar() { if (!selectedProduct) return; const tieneAcomp = getAcomps(selectedProduct.id).length > 0; if (tieneAcomp) { let ep = 0; const names: string[] = []; for (const id of selectedAcomps) { const a = acompanamientos.find(x => x.id === id); if (a) { ep += a.recargo; names.push(a.nombre); } } const name = names.length > 0 ? names.join(' + ') : 'Sin acompañamiento'; cart = [...cart, { id: crypto.randomUUID?.() ?? Math.random().toString(36).substring(2), producto: selectedProduct, cantidad: 1, acompanamiento: name, subtotal: selectedProduct.precio + ep }]; } else { cart = [...cart, { id: crypto.randomUUID?.() ?? Math.random().toString(36).substring(2), producto: selectedProduct, cantidad: 1, acompanamiento: 'Sin acompañamiento', subtotal: selectedProduct.precio }]; } closeModal(); }
  function remove(id: string) { cart = cart.filter(i => i.id !== id); }
  function goCheckout() { if (cart.length === 0) return; step = 'datos'; efectivoConCuanto = getTotal(); }
  function back() { step = 'menu'; }

  async function submitOrder() {
    if (!nombre.trim() || !telefono.trim()) { orderError = 'Nombre y teléfono son obligatorios'; return; }
    if (modo === 'delivery') {
      if (!zona) { orderError = 'Seleccioná una zona de delivery'; return; }
      if (!direccion.trim()) { orderError = 'La dirección es obligatoria'; return; }
    }

    const tipo = modo === 'retiro' ? '🏃 *Retiro en local*' : `🛵 *Delivery* - ${zona}`;
    const metodoStr = metodoPago === 'efectivo' ? `Efectivo${efectivoConCuanto > getTotal() ? ` (paga con ${formatCLP(efectivoConCuanto)})` : ''}` : metodoPago === 'debito' ? 'Débito' : 'Crédito';
    
    let msg = `*La Cascada - Nuevo Pedido*%0A${tipo}%0A%0A`;
    msg += `*Cliente:* ${nombre.trim()}%0A`;
    msg += `*Tel:* ${telefono.trim()}%0A`;
    if (modo === 'delivery') msg += `*Dir:* ${direccion.trim()}%0A`;
    msg += `*Pago:* ${metodoStr}%0A%0A`;
    msg += `*Pedido:*%0A`;
    for (const item of cart) {
      msg += `${item.cantidad}x ${item.producto.nombre} - ${formatCLP(item.subtotal)}%0A`;
      if (item.acompanamiento && item.acompanamiento !== 'Sin acompañamiento') msg += `  + ${item.acompanamiento}%0A`;
    }
    msg += `%0A`;
    msg += `*Subtotal:* ${formatCLP(getSubtotalProductos())}%0A`;
    if (getCostoEnvio() > 0) msg += `*Envío (${zona}):* ${formatCLP(getCostoEnvio())}%0A`;
    msg += `*TOTAL:* ${formatCLP(getTotal())}%0A`;
    if (metodoPago === 'efectivo' && efectivoConCuanto > getTotal()) msg += `*Vuelto:* ${formatCLP(efectivoConCuanto - getTotal())}%0A`;

    window.open(`https://wa.me/56966937327?text=${msg}`, '_blank');
    orderSuccess = true; pedidoId = null; vuelto = 0; step = 'exito';
  }

  function nuevoPedido() { cart = []; nombre = ''; direccion = ''; telefono = ''; zona = ''; modo = 'delivery'; metodoPago = 'efectivo'; efectivoConCuanto = 0; orderSuccess = false; orderError = ''; step = 'menu'; }
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
          <p class="text-[11px] tracking-wider uppercase" style="color: #6b5d4f;">{modo === 'retiro' ? 'Retiro en local' : 'Delivery'}</p>
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
        <p class="text-[#6b5d4f] text-xs tracking-[0.2em] uppercase mb-2">{modo === 'retiro' ? 'Retiro en local' : 'Delivery a domicilio'}</p>
        <h2 class="font-display text-3xl md:text-4xl text-[#1a1410] font-bold leading-tight">{modo === 'retiro' ? 'Pide y retira en el local' : 'Pide desde tu casa'}</h2>
        <p class="text-[#6b5d4f] text-sm mt-2 max-w-lg leading-relaxed">{modo === 'retiro' ? 'Hacé tu pedido y pasá a buscarlo por el restaurante.' : 'Elegí tus platos favoritos y te los llevamos.'}</p>
      </div>

      <!-- Modo selector -->
      <div class="flex gap-2 mb-6">
        <button class="flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 {modo === 'delivery' ? 'border-[#c9a227] bg-[#c9a227] text-white' : 'border-[#e8e0d0] bg-white text-[#6b5d4f]'}" onclick={() => { modo = 'delivery'; activeCategoria = categorias[0]?.id || 0; }}>🛵 Delivery</button>
        <button class="flex-1 py-3 rounded-xl text-sm font-bold transition-all border-2 {modo === 'retiro' ? 'border-[#c9a227] bg-[#c9a227] text-white' : 'border-[#e8e0d0] bg-white text-[#6b5d4f]'}" onclick={() => { modo = 'retiro'; activeCategoria = categorias[0]?.id || 0; }}>🏃 Retiro en local</button>
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
          <p class="text-[#6b5d4f] text-sm mb-6">{modo === 'retiro' ? 'Completá para tu retiro en local' : 'Completá para recibir tu pedido'}</p>

          <div class="space-y-4 mb-6">
            <div><label class="block text-xs font-semibold text-[#1a1410] uppercase tracking-wider mb-1.5">Nombre</label><input type="text" bind:value={nombre} placeholder="Tu nombre completo" class="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all" style="border-color:#e8e0d0; background-color:#faf6f0;" onfocus={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#c9a227'; }} onblur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#e8e0d0'; }} /></div>

            {#if modo === 'delivery'}
              <div>
                <label class="block text-xs font-semibold text-[#1a1410] uppercase tracking-wider mb-2">Zona de delivery</label>
                <div class="grid grid-cols-2 gap-2">
                  {#each Object.keys(costoZonas) as z}
                    <label class="flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-all {zona === z ? 'border-[#c9a227] bg-[#faf6f0]' : 'border-[#e8e0d0]'}">
                      <input type="radio" bind:group={zona} value={z} class="sr-only" />
                      <span class="text-sm font-semibold text-[#1a1410]">{z}</span>
                      <span class="text-xs text-[#c9a227] font-bold mt-1">+{formatCLP(costoZonas[z])}</span>
                    </label>
                  {/each}
                </div>
              </div>
              <div><label class="block text-xs font-semibold text-[#1a1410] uppercase tracking-wider mb-1.5">Dirección</label><input type="text" bind:value={direccion} placeholder="Calle, número, depto" class="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all" style="border-color:#e8e0d0; background-color:#faf6f0;" onfocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#c9a227'; }} onblur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#e8e0d0'; }} /></div>
            {/if}

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
                <div class="flex justify-between items-center text-sm">
                  <div class="flex-1 min-w-0">
                    <span class="text-[#2d2418]">{item.cantidad}x {item.producto.nombre}</span>
                    {#if item.acompanamiento && item.acompanamiento !== 'Sin acompañamiento'}<p class="text-xs opacity-50">+ {item.acompanamiento}</p>{/if}
                  </div>
                  <span class="font-semibold text-[#1a1410] shrink-0 mr-2">{formatCLP(item.subtotal)}</span>
                  <button class="text-red-400 hover:text-red-600 text-lg leading-none px-1" onclick={() => remove(item.id)} title="Eliminar">&times;</button>
                </div>
              {/each}
            </div>
            {#if getCostoEnvio() > 0}
              <div class="flex justify-between text-sm border-t pt-2 mb-2" style="border-color:#e8e0d0;">
                <span class="text-[#6b5d4f]">Envío ({zona})</span>
                <span class="font-semibold text-[#c9a227]">{formatCLP(getCostoEnvio())}</span>
              </div>
            {/if}
            <div class="border-t pt-3 flex justify-between items-center" style="border-color:#e8e0d0;"><span class="font-bold text-[#1a1410]">Total</span><span class="text-xl font-bold" style="color:#c9a227;">{formatCLP(getTotal())}</span></div>
            {#if modo === 'retiro'}<p class="text-xs text-[#6b5d4f] mt-2 text-center">📍 Retirás en Rioseco #267, Lebu</p>{/if}
          </div>

          {#if orderError}<div class="rounded-xl p-3 mb-4 text-sm font-medium" style="background-color:#fef2f2; color:#dc2626; border:1px solid #fecaca;">{orderError}</div>{/if}

          <button class="w-full py-3.5 rounded-xl text-white font-bold text-lg transition-all shadow-lg" style="background-color:#c9a227;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#b8922a'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#c9a227'; }} onclick={submitOrder}>Confirmar · {formatCLP(getTotal())}</button>
        </div>
      </div>

    <!-- STEP: ÉXITO -->
    {:else if step === 'exito'}
      <div class="max-w-md mx-auto pt-12 text-center">
        <div class="rounded-3xl p-8 sm:p-10 shadow-lg border animate-fade-in" style="background-color:#fff; border-color:#e8e0d0;">
          <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style="background-color:#f0fdf4;"><span class="text-3xl">✅</span></div>
          <h2 class="font-display text-2xl text-[#1a1410] font-bold mb-2">¡Pedido enviado!</h2>
          <p class="text-[#6b5d4f] text-sm mb-4">Tu pedido fue enviado por WhatsApp. Te contactaremos para confirmar.</p>
          {#if modo === 'retiro'}
            <p class="text-[#6b5d4f] text-sm mt-6 leading-relaxed">Revisaremos tu pedido y te contactaremos al <span class="font-semibold text-[#1a1410]">{telefono}</span> para coordinar{modo === 'retiro' ? ' el retiro' : ' el despacho'}.</p>
          {/if}
          <button class="w-full py-3.5 rounded-xl text-white font-bold mt-8 transition-all" style="background-color:#c9a227;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#b8922a'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#c9a227'; }} onclick={nuevoPedido}>Hacer otro pedido</button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <footer class="border-t py-10 px-4 mt-8" style="border-color:#e8e0d0; background-color:#fff;">
    <div class="max-w-5xl mx-auto text-center">
      <p class="font-display text-xl text-[#c9a227] font-bold">La Cascada</p>
      <p class="text-[#6b5d4f] text-xs mt-1">{modo === 'retiro' ? 'Retiro en local' : 'Delivery'} &bull; Rioseco #267, Lebu</p>
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
      {#if getAcomps(selectedProduct.id).length > 0}
        <div class="mb-4">
          <p class="text-xs font-semibold text-[#6b5d4f] uppercase tracking-wider mb-2">Acompañamientos (máx. 2) {#if selectedAcomps.length === 0}<span class="text-red-400 font-normal normal-case">— Sin acompañamiento</span>{/if}</p>
          <div class="space-y-2">
            {#each getAcomps(selectedProduct.id) as acomp (acomp.id)}
              {@const disabled = selectedAcomps.length >= 2 && !selectedAcomps.includes(acomp.id)}
              <label class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all {selectedAcomps.includes(acomp.id) ? 'border-[#c9a227] bg-[#faf6f0]' : 'border-[#e8e0d0] hover:border-[#c9a227]/50'} {disabled ? 'opacity-40 pointer-events-none' : ''}">
                <input type="checkbox" checked={selectedAcomps.includes(acomp.id)} disabled={disabled} onchange={(e) => { if (e.target.checked) selectedAcomps = [...selectedAcomps, acomp.id]; else selectedAcomps = selectedAcomps.filter(id => id !== acomp.id); }} style="accent-color:#c9a227;" />
                <span class="flex-1 text-sm font-medium text-[#2d2418]">{acomp.nombre}</span>
                {#if acomp.recargo > 0}<span class="text-sm text-[#c9a227] font-bold">+{formatCLP(acomp.recargo)}</span>{/if}
              </label>
            {/each}
          </div>
        </div>
      {/if}
      {#if confirmStep}
        <div class="text-center">
          <p class="text-sm font-medium text-gray-700 mb-3">Agregar {selectedProduct?.nombre} al carro?</p>
          <div class="flex gap-3">
            <button class="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-600 font-semibold transition-all text-base" onclick={() => { confirmStep = false }}>No, cancelar</button>
            <button class="flex-1 py-3 rounded-xl text-white font-semibold transition-all text-base" style="background-color:#c9a227;" onclick={confirmarYAgregar}>Si, agregar</button>
          </div>
        </div>
      {:else}
        <button class="w-full py-3.5 rounded-xl text-white font-semibold transition-all text-base" style="background-color:#c9a227;" onclick={prepararAddToCart}>Agregar al pedido</button>
      {/if}
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
