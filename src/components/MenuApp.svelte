<script lang="ts">
  import Cart from './Cart.svelte';
  import type { Producto, Acompanamiento } from '../lib/types';

  function generateId(): string {
    return crypto.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
  }

  let { piso: urlPiso = 0, mesa: urlMesa = 0, menuData = null } = $props<{ piso?: number; mesa?: number; menuData?: any }>();

  let step: 'confirmacion' | 'mesa' | 'menu' | 'verificando' = $state(urlPiso > 0 && urlMesa > 0 ? 'verificando' : 'confirmacion');
  let piso: number = $state(urlPiso || 1);
  let mesa: number = $state(urlMesa || 0);
  let mesaError: string = $state('');
  let mesasDisponibles: any[] = $state([]);
  let cargandoMesas: boolean = $state(false);

  let categorias = $state.raw(menuData?.categorias || []);
  let productos = $state.raw(menuData?.productos || []);
  let acompanamientos = $state.raw(menuData?.acompanamientos || []);
  let productosAcomp = $state.raw(menuData?.productos_acompanamientos || []);

  let activeCategoria = $state.raw(categorias[0]?.id || 0);
  let loading: boolean = $state(!menuData);
  let showCart: boolean = $state(false);
  let cartItems: CartItem[] = $state([]);
  let showAcompModal: boolean = $state(false);
  let selectedProduct: Producto | null = $state(null);
  let selectedAcomps: number[] = $state([]);
  let confirmStep: boolean = $state(false);
  let showSuccess: boolean = $state(false);
  let orderError: string = $state('');
  let nombreComensal: string = $state('');
  let pedidoRealizado: boolean = $state(false);
  let inactividadTimeout: ReturnType<typeof setTimeout> | null = null;

  function liberarMesaSiNoPidio() {
    if (!pedidoRealizado && step === 'menu') {
      navigator.sendBeacon('/api/mesas/liberar', JSON.stringify({ piso, mesa_numero: mesa }));
    }
  }

  function reiniciarTimerInactividad() {
    if (inactividadTimeout) clearTimeout(inactividadTimeout);
    inactividadTimeout = setTimeout(() => {
      inactividadTimeout = null;
      if (!pedidoRealizado && step === 'menu') {
        fetch('/api/mesas/liberar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ piso, mesa_numero: mesa }),
        });
      }
    }, 10 * 60 * 1000);
  }

  function onActividadUsuario() {
    if (step === 'menu') reiniciarTimerInactividad();
  }

  $effect(() => {
    if (step === 'menu') {
      window.addEventListener('beforeunload', liberarMesaSiNoPidio);
      window.addEventListener('pagehide', liberarMesaSiNoPidio);
      window.addEventListener('click', onActividadUsuario);
      window.addEventListener('touchstart', onActividadUsuario);
      window.addEventListener('keydown', onActividadUsuario);
      reiniciarTimerInactividad();
    }
    return () => {
      window.removeEventListener('beforeunload', liberarMesaSiNoPidio);
      window.removeEventListener('pagehide', liberarMesaSiNoPidio);
      window.removeEventListener('click', onActividadUsuario);
      window.removeEventListener('touchstart', onActividadUsuario);
      window.removeEventListener('keydown', onActividadUsuario);
      if (inactividadTimeout) { clearTimeout(inactividadTimeout); inactividadTimeout = null; }
    };
  });

  interface CartItem { id: string; producto: Producto; cantidad: number; baseAcomp: string | null; extras: string[]; precioTotal: number; }

  let filteredProductos = $state<Producto[]>([]);
  $effect(() => { filteredProductos = activeCategoria ? productos.filter((p: Producto) => p.categoria_id === activeCategoria) : []; });

  const CAT_ICONS: Record<string, string> = { 'Completos y Ases':'🌭','Sándwiches de la Casa':'🥪','Plant-Based (Vegano)':'🌱','Para Compartir':'🍽️','Promociones':'⭐','Colaciones':'🍛','Extras':'🍟','Completos':'🌭','Sandwichs':'🥪','Bebidas':'🥤','Té':'🍵','Cafés':'☕','Alcoholes':'🍺' };
  function catIcon(nombre: string): string { return CAT_ICONS[nombre] || '📋'; }

  function getAcompForProducto(id: number): Acompanamiento[] {
    const ids = productosAcomp.filter((pa: any) => pa.producto_id === id).map((pa: any) => pa.acompanamiento_id);
    return acompanamientos.filter(a => ids.includes(a.id));
  }

  async function cargarMesasDisponibles(pisoSel: number, silencioso = false) {
    if (!silencioso) cargandoMesas = true; mesaError = '';
    try {
      const res = await fetch(`/api/mesas/disponibles?_t=${Date.now()}`, { cache: 'no-store' });
      const d = await res.json();
      mesasDisponibles = (d.mesas || []).filter((m: any) => m.piso === pisoSel && m.estado === 'libre').sort((a: any, b: any) => a.numero_mesa - b.numero_mesa);
    } catch { mesasDisponibles = []; mesaError = 'Error al cargar mesas.'; }
    finally { if (!silencioso) cargandoMesas = false; }
  }

  async function verificarMesaQR(pisoQR: number, mesaQR: number) {
    cargandoMesas = true;
    try {
      const res = await fetch(`/api/mesas/disponibles?_t=${Date.now()}`, { cache: 'no-store' });
      const d = await res.json(); const todas = d.mesas || [];
      const enc = todas.find((m: any) => m.numero_mesa === mesaQR && m.piso === pisoQR);
      if (enc) {
        mesa = mesaQR; piso = pisoQR; step = 'menu';
        if (enc.estado !== 'libre') mesaError = 'Ya tenés pedidos activos en esta mesa. Podés seguir agregando.';
        ocuparMesa();
        await cargarMenuSiNecesario();
      } else {
        step = 'mesa'; mesaError = `La Mesa ${mesaQR} del Piso ${pisoQR} no existe.`; piso = pisoQR; await cargarMesasDisponibles(pisoQR);
      }
    } catch { step = 'mesa'; mesaError = 'Error al verificar.'; await cargarMesasDisponibles(pisoQR); }
    finally { cargandoMesas = false; }
  }

  async function cargarMenuSiNecesario() {
    if (!menuData) {
      loading = true;
      try {
        const mr = await fetch('/api/menu');
        if (!mr.ok) throw new Error('HTTP ' + mr.status);
        const md = await mr.json();
        categorias = md.categorias || [];
        productos = md.productos || [];
        acompanamientos = md.acompanamientos || [];
        productosAcomp = md.productos_acompanamientos || [];
        if (categorias.length > 0) activeCategoria = categorias[0].id;
        mesaError = '';
      } catch {
        mesaError = 'No se pudo cargar el menú. Verifica tu conexión y vuelve a intentar.';
      } finally {
        loading = false;
      }
      if (mesaError) return;
    }
  }

  async function ocuparMesa() {
    try {
      await fetch('/api/mesas/ocupar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piso, mesa_numero: mesa }),
      });
    } catch { /* silencioso, no es crítico */ }
  }

  async function seleccionarMesa(m: any) {
    cargandoMesas = true; mesaError = '';
    try {
      const res = await fetch(`/api/mesas/disponibles?_t=${Date.now()}`, { cache: 'no-store' });
      const d = await res.json(); const actual = (d.mesas || []).find((t: any) => t.id === m.id);
      if (actual && actual.estado === 'libre') { mesa = m.numero_mesa; piso = m.piso; step = 'menu'; cargarMenuSiNecesario(); }
      else { mesaError = `Mesa ${m.numero_mesa} ya está ocupada.`; await cargarMesasDisponibles(piso); }
    } catch { mesaError = 'Error al verificar.'; }
    finally { cargandoMesas = false; }
  }

  $effect(() => { if (step === 'verificando') verificarMesaQR(urlPiso, urlMesa); });

  let menuPolling: ReturnType<typeof setInterval> | null = null;
  let mesaPolling: ReturnType<typeof setInterval> | null = null;
  let actualizandoMenu: boolean = $state(false);

  $effect(() => { if (step === 'menu') { if (!menuPolling) menuPolling = setInterval(actualizarMenu, 30000); } else { if (menuPolling) { clearInterval(menuPolling); menuPolling = null; } } });
  $effect(() => { if (step === 'mesa') { if (!mesaPolling) mesaPolling = setInterval(() => { cargarMesasDisponibles(piso, true); }, 30000); } else { if (mesaPolling) { clearInterval(mesaPolling); mesaPolling = null; } } });

  async function actualizarMenu() { if (actualizandoMenu) return; actualizandoMenu = true; try { const mr = await fetch('/api/menu?_t=' + Date.now()); const md = await mr.json(); categorias = md.categorias || []; productos = md.productos || []; acompanamientos = md.acompanamientos || []; productosAcomp = md.productos_acompanamientos || []; } catch {} finally { actualizandoMenu = false; } }

  function openAcompModal(p: Producto) { selectedProduct = p; selectedAcomps = []; confirmStep = false; showAcompModal = true; }
  function closeAcompModal() { showAcompModal = false; selectedProduct = null; selectedAcomps = []; confirmStep = false; }

  function prepararAddToCart() { confirmStep = true; }
  function addToCart() {
    if (!selectedProduct) return;
    const tieneAcomp = getAcompForProducto(selectedProduct.id).length > 0;
    if (tieneAcomp) {
      let precio = selectedProduct.precio; const names: string[] = [];
      for (const id of selectedAcomps) { const a = acompanamientos.find(x => x.id === id); if (a) { precio += a.recargo; names.push(a.nombre); } }
      cartItems = [...cartItems, { id: generateId(), producto: selectedProduct, cantidad: 1, baseAcomp: names.join(', ') || null, extras: [], precioTotal: precio }];
    } else {
      cartItems = [...cartItems, { id: generateId(), producto: selectedProduct, cantidad: 1, baseAcomp: null, extras: [], precioTotal: selectedProduct.precio }];
    }
    closeAcompModal();
  }

  function removeFromCart(id: string) { cartItems = cartItems.filter(i => i.id !== id); }
  function getCartTotal() { return cartItems.reduce((s, i) => s + i.precioTotal * i.cantidad, 0); }

  function handleProductClick(p: Producto) {
    openAcompModal(p);
  }

  async function submitOrder() {
    if (cartItems.length === 0) return; orderError = '';

    let msg = `*La Cascada - Pedido en Mesa*\n🍽️ *Autoatención* - Piso ${piso} Mesa ${mesa}\n\n`;
    if (nombreComensal.trim()) msg += `*Cliente:* ${nombreComensal.trim()}\n\n`;
    msg += `*Pedido:*\n`;
    for (const i of cartItems) {
      msg += `${i.cantidad}x ${i.producto.nombre} - ${formatCLP(i.precioTotal * i.cantidad)}\n`;
      if (i.baseAcomp) msg += `  + ${i.baseAcomp}\n`;
    }
    msg += `\n*TOTAL:* ${formatCLP(getCartTotal())}\n`;

    window.open(`https://wa.me/56983329958?text=${encodeURIComponent(msg)}`, '_blank');
    cartItems = []; showCart = false; showSuccess = true; pedidoRealizado = true; setTimeout(() => { showSuccess = false; }, 5000);
  }

  function formatCLP(n: number) { return '$' + n.toLocaleString('es-CL'); }
</script>

<!-- ============ SELECCIÓN DE MESA ============ -->
{#if step === 'mesa' || step === 'verificando' || step === 'confirmacion'}
  <div class="min-h-screen flex items-center justify-center p-4" style="background-color: #F8FAF9;">

    <div class="relative z-10 w-full max-w-lg animate-fade-in">
      <div class="text-center mb-8">
        <h1 class="font-display text-4xl sm:text-5xl md:text-6xl font-bold mb-2 tracking-tight" style="color: #205C66;">La Cascada</h1>
        <p class="text-[#52737A] text-sm tracking-widest uppercase">Menú Digital</p>
      </div>

      {#if step === 'verificando'}
        <div class="flex flex-col items-center py-12 gap-4"><div class="w-10 h-10 border-2 border-[#205C6633] border-t-[#205C66] rounded-full animate-spin"></div><p class="text-[#52737A] text-sm">Verificando mesa...</p></div>
      {:else if step === 'confirmacion'}
        <div class="rounded-2xl p-8 shadow-lg border text-center" style="background-color:#fff; border-color:#D8E4E2;">
          <p class="text-4xl mb-4">📍</p>
          <h2 class="font-display text-2xl font-bold mb-3" style="color:#205C66;">¿Estás en La Cascada?</h2>
          <p class="text-[#52737A] text-sm mb-6 leading-relaxed">La autoatención es solo para clientes <strong>dentro del restaurante</strong>. Si estás en tu casa o en otro lugar, usá el delivery.</p>
          <div class="flex flex-col gap-3">
            <button class="w-full py-3.5 rounded-xl text-white font-bold text-base transition-all" style="background-color:#205C66;" onclick={async () => { step = 'mesa'; piso = 1; await cargarMesasDisponibles(1); }}>Sí, estoy en el local</button>
            <a href="/delivery" class="w-full py-3.5 rounded-xl border-2 font-semibold text-base transition-all no-underline text-center" style="border-color:#D8E4E2; color:#52737A;">No, quiero pedir delivery</a>
          </div>
        </div>
      {:else}
        {#if mesaError}<div class="bg-red-500/10 border border-red-400/30 rounded-xl p-4 text-sm mb-6 text-center" style="color: #B33A3A;">{mesaError}</div>{/if}

        <p class="text-sm text-center mb-2 tracking-wide uppercase" style="color: #52737A;">Seleccioná tu mesa</p>
        <div class="flex gap-3 mb-6">
          {#each [1, 2] as p}
            <button class="flex-1 py-3 rounded-xl font-medium text-sm tracking-wide transition-all border {piso === p ? 'bg-[#205C66]/10 border-[#205C66]/50 text-[#205C66]' : 'border-[#D8E4E2] text-[#52737A] hover:border-[#205C66] hover:text-[#1A373A]'}" onclick={() => { piso = p; cargarMesasDisponibles(p); }}>Piso {p}</button>
          {/each}
        </div>

        {#if cargandoMesas}
          <div class="flex justify-center py-8"><div class="w-6 h-6 border-2 border-[#205C6633] border-t-[#205C66] rounded-full animate-spin"></div></div>
        {:else if mesasDisponibles.length === 0}
          <div class="text-center py-8"><p class="text-lg" style="color: #8AA6AA;">Sin mesas disponibles</p><p class="text-sm mt-2" style="color: #52737A;">Todas las mesas del Piso {piso} están ocupadas</p></div>
        {:else}
          <div class="grid grid-cols-4 sm:grid-cols-5 gap-3">
            {#each mesasDisponibles as m (m.id)}
              <button class="aspect-square rounded-xl border border-[#D8E4E2] hover:border-[#205C66]/50 hover:bg-[#205C66]/10 transition-all flex flex-col items-center justify-center gap-1 group" onclick={() => seleccionarMesa(m)}>
                <span class="text-lg opacity-30 group-hover:opacity-60 transition-opacity">🍽️</span>
                <span class="group-hover:text-[#205C66] font-semibold text-sm transition-colors" style="color: #1A373A;">M{m.numero_mesa}</span>
              </button>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </div>

<!-- ============ MENÚ ============ -->
{:else}
<div class="min-h-screen" style="background-color: #F8FAF9; color: #1A373A;">

  <!-- Header -->
  <header class="sticky top-0 z-30 border-b" style="background-color: rgba(248,250,249,0.92); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-color: #D8E4E2;">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <img src="/lacascadapro.png" alt="La Cascada" class="w-8 h-8 rounded-full shrink-0" />
        <div>
          <h1 class="font-display text-base text-[#205C66] font-semibold leading-none">La Cascada</h1>
          <p class="text-[11px] text-[#52737A] mt-0.5">Piso {piso} · Mesa {mesa}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <input
          type="text"
          bind:value={nombreComensal}
          placeholder="Tu nombre"
          maxlength="20"
          class="w-28 sm:w-36 px-3 py-1.5 rounded-full text-xs border outline-none transition-all"
          style="border-color:#D8E4E2; background-color:#fff;"
          onfocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#205C66'; }}
          onblur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#D8E4E2'; }}
        />
        <button
          class="relative px-4 py-2 rounded-full text-xs font-semibold text-white transition-all shadow-md flex items-center gap-1.5 shrink-0"
          style="background-color: #205C66;"
          onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#184A52'; }}
          onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#205C66'; }}
          onclick={() => { showCart = !showCart; showSuccess = false }}
        >🛒 {#if cartItems.length > 0}<span class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#C04A33] text-white text-[11px] flex items-center justify-center font-bold">{cartItems.length}</span>{/if}</button>
      </div>
    </div>
  </header>

  {#if mesaError}
    <div class="max-w-6xl mx-auto px-4 sm:px-6 pt-2">
      <div class="rounded-xl p-3 text-sm text-center font-medium flex items-center justify-center gap-3" style="background-color:#fef3c7; color:#92400e; border:1px solid #fcd34d;">
        <span class="cursor-pointer" onclick={() => { mesaError = ''; }}>{mesaError} <span class="text-xs opacity-60">(tocá para cerrar)</span></span>
        {#if categorias.length === 0 && !loading}
          <button class="px-3 py-1 rounded-full text-xs font-bold text-white shrink-0" style="background-color:#92400e;" onclick={() => { mesaError = ''; cargarMenuSiNecesario(); }}>Reintentar</button>
        {/if}
      </div>
    </div>
  {/if}

  <div class="max-w-6xl mx-auto px-4 sm:px-6 pb-32">
    {#if loading}
      <div class="flex flex-col items-center justify-center py-32 gap-3"><div class="w-10 h-10 border-2 border-[#205C66]/30 border-t-[#205C66] rounded-full animate-spin"></div><p class="text-[#52737A] text-sm">Cargando menú...</p></div>
    {:else}
      <!-- Hero -->
      <div class="pt-8 pb-6">
        <p class="text-[#52737A] text-xs tracking-[0.2em] uppercase mb-2">Carta Digital</p>
        <h2 class="font-display text-3xl md:text-4xl text-[#205C66] font-bold leading-tight">Nuestro Menú</h2>
        <p class="text-[#52737A] text-sm mt-2 max-w-lg leading-relaxed">Descubrí nuestros platos preparados con ingredientes frescos. Seleccioná una categoría y armá tu pedido.</p>
      </div>

      <!-- Categorías -->
      <nav class="flex gap-2 overflow-x-auto pb-1 mb-4 sm:mb-8 sticky top-[57px] z-20 pt-2 scrollbar-hide" style="background: linear-gradient(to bottom, #F8FAF9 60%, transparent);">
        {#each categorias as cat (cat.id)}
          <button
            class="shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border"
            style="{activeCategoria === cat.id ? 'background-color:#205C66; color:#fff; border-color:#205C66;' : 'background-color:#fff; color:#52737A; border-color:#D8E4E2;'}"
            onclick={() => { activeCategoria = cat.id }}
          ><span class="mr-1">{catIcon(cat.nombre)}</span> {cat.nombre}</button>
        {/each}
      </nav>

      <!-- Productos -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {#each filteredProductos as producto (producto.id)}
          <button
            class="text-left rounded-xl p-5 transition-all duration-300 w-full group border"
            style="background-color:#fff; border-color:#D8E4E2;"
            onmouseenter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#205C66'; el.style.boxShadow = '0 4px 24px rgba(32,92,102,0.10)'; }}
            onmouseleave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#D8E4E2'; el.style.boxShadow = 'none'; }}
            onclick={() => handleProductClick(producto)}
          >
            <div class="flex justify-between items-start gap-4">
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-[#1A373A] text-base group-hover:text-[#205C66] transition-colors leading-snug">{producto.nombre}</h3>
                {#if producto.ingredientes}
                  <p class="text-[#52737A] text-xs leading-relaxed mt-1 line-clamp-2">{producto.ingredientes}</p>
                {/if}
              </div>
              <div class="text-right shrink-0">
                <span class="font-bold text-[#C04A33] text-base">{formatCLP(producto.precio)}</span>
                {#if producto.maneja_stock}
                  <p class="text-[11px] text-[#52737A] mt-0.5">{producto.stock_actual} disp.</p>
                {/if}
              </div>
            </div>
          </button>
        {/each}
      </div>

      {#if filteredProductos.length === 0}
        <div class="text-center py-20"><p class="text-4xl mb-3 opacity-30">🍽️</p><p class="text-[#52737A]">No hay productos en esta categoría</p></div>
      {/if}
    {/if}
  </div>

  <!-- Footer -->
  <footer class="border-t py-10 px-4 mt-8" style="border-color:#D8E4E2; background-color:#fff;">
    <div class="max-w-6xl mx-auto text-center">
      <p class="font-display text-xl text-[#205C66] font-bold">La Cascada</p>
      <p class="text-[#52737A] text-xs mt-1">Restaurant &bull; Rioseco #267, Lebu</p>
      <p class="text-[#52737A] text-xs">+569 66937327</p>
    </div>
  </footer>
</div>
{/if}

<!-- Cart -->
{#if showCart}
  <Cart {cartItems} {acompanamientos} {orderError} on:remove={(e) => removeFromCart(e.detail)} on:submit={submitOrder} on:close={() => { showCart = false }} total={getCartTotal()} />
{/if}

<!-- Acomp Modal -->
{#if showAcompModal && selectedProduct}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick={closeAcompModal}></div>
    <div class="relative w-full sm:max-w-md max-h-[80vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-6 z-10 shadow-2xl animate-slide-up" style="background-color:#fff;">
      <div class="flex items-center gap-4 mb-5">
        <span class="text-3xl">{catIcon(selectedProduct.categoria_nombre || '')}</span>
        <div>
          <h3 class="font-semibold text-lg text-[#1A373A]">{selectedProduct.nombre}</h3>
          <p class="text-[#C04A33] font-bold">{formatCLP(selectedProduct.precio)}</p>
        </div>
      </div>

      {#if getAcompForProducto(selectedProduct.id).length > 0}
        <div class="mb-4">
          <p class="text-xs font-semibold text-[#52737A] uppercase tracking-wider mb-2">Acompañamientos (máx. 2) {#if selectedAcomps.length === 0}<span class="text-red-400 font-normal normal-case">— Sin acompañamiento</span>{/if}</p>
          <div class="space-y-2">
            {#each getAcompForProducto(selectedProduct.id) as acomp (acomp.id)}
              {@const disabled = selectedAcomps.length >= 2 && !selectedAcomps.includes(acomp.id)}
              <label class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all {selectedAcomps.includes(acomp.id) ? 'border-[#205C66] bg-[#F8FAF9]' : 'border-[#D8E4E2] hover:border-[#205C66]/50'} {disabled ? 'opacity-40 pointer-events-none' : ''}">
                <input type="checkbox" checked={selectedAcomps.includes(acomp.id)} disabled={disabled} onchange={(e) => { if (e.target.checked) selectedAcomps = [...selectedAcomps, acomp.id]; else selectedAcomps = selectedAcomps.filter(id => id !== acomp.id); }} style="accent-color: #205C66;" />
                <span class="flex-1 text-sm font-medium text-[#1A373A]">{acomp.nombre}</span>
                {#if acomp.recargo > 0}<span class="text-sm text-[#C04A33] font-bold">+{formatCLP(acomp.recargo)}</span>{/if}
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
            <button class="flex-1 py-3 rounded-xl text-white font-semibold transition-all text-base" style="background-color:#205C66;" onclick={addToCart}>Si, agregar</button>
          </div>
        </div>
      {:else}
        <button class="w-full py-3.5 rounded-xl text-white font-semibold transition-all text-base" style="background-color:#205C66;" onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#184A52'; }} onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#205C66'; }} onclick={prepararAddToCart}>Agregar al pedido</button>
      {/if}
    </div>
  </div>
{/if}

<!-- Success -->
{#if showSuccess}
  <div class="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-slide-up">
    <div class="rounded-2xl p-5 shadow-2xl flex items-center gap-3 text-white" style="background-color:#205C66;">
      <span class="text-2xl">✅</span>
      <div><p class="font-bold">¡Pedido enviado!</p><p class="text-xs text-white/50">Piso {piso} · Mesa {mesa} — Enviado por WhatsApp</p></div>
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
