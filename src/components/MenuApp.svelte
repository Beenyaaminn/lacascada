<script lang="ts">
  import { onMount } from 'svelte';
  import Cart from './Cart.svelte';
  import ProductCard from './ProductCard.svelte';
  import { type Categoria, type Producto, type Acompanamiento, type ProductoAcompanamiento } from '../lib/types';

  function generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  let { piso = 1, mesa = 1, menuData = null } = $props<{ piso?: number; mesa?: number; menuData?: any }>();

  let categorias: Categoria[] = $state(menuData?.categorias || []);
  let productos: Producto[] = $state(menuData?.productos || []);
  let acompanamientos: Acompanamiento[] = $state(menuData?.acompanamientos || []);
  let productosAcomp: ProductoAcompanamiento[] = $state(menuData?.productos_acompanamientos || []);

  let activeCategoria: number | null = $state(null);
  let loading: boolean = $state(!menuData);
  let showCart: boolean = $state(false);
  let cartItems: CartItem[] = $state([]);
  let showAcompModal: boolean = $state(false);
  let selectedProduct: Producto | null = $state(null);
  let selectedBaseAcomp: number | null = $state(null);
  let selectedExtras: number[] = $state([]);
  let showSuccess: boolean = $state(false);
  let orderError: string = $state('');

  interface CartItem {
    id: string;
    producto: Producto;
    cantidad: number;
    baseAcomp: string | null;
    extras: string[];
    precioTotal: number;
  }

  onMount(async () => {
    if (menuData) {
      if (categorias.length > 0) {
        activeCategoria = categorias[0].id;
      }
      loading = false;
      return;
    }
    try {
      const res = await fetch('/api/menu');
      const data = await res.json();
      categorias = data.categorias || [];
      productos = data.productos || [];
      acompanamientos = data.acompanamientos || [];
      productosAcomp = data.productos_acompanamientos || [];
      if (categorias.length > 0) {
        activeCategoria = categorias[0].id;
      }
    } catch (e) {
      console.error('Error cargando menú:', e);
    } finally {
      loading = false;
    }
  });

  function getProductosByCategoria(categoriaId: number): Producto[] {
    return productos.filter(p => p.categoria_id === categoriaId);
  }

  function getAcompForProducto(productoId: number): Acompanamiento[] {
    const acompIds = productosAcomp
      .filter(pa => pa.producto_id === productoId)
      .map(pa => pa.acompanamiento_id);
    return acompanamientos.filter(a => acompIds.includes(a.id));
  }

  function getBaseAcomp(productoId: number): Acompanamiento[] {
    return getAcompForProducto(productoId).filter(a => !a.es_extra);
  }

  function getExtraAcomp(productoId: number): Acompanamiento[] {
    return getAcompForProducto(productoId).filter(a => a.es_extra);
  }

  function openAcompModal(producto: Producto) {
    selectedProduct = producto;
    selectedBaseAcomp = null;
    selectedExtras = [];
    showAcompModal = true;
  }

  function closeAcompModal() {
    showAcompModal = false;
    selectedProduct = null;
    selectedBaseAcomp = null;
    selectedExtras = [];
  }

  function addToCart() {
    if (!selectedProduct) return;

    const hasBaseAcomp = getBaseAcomp(selectedProduct.id).length > 0;
    if (hasBaseAcomp && !selectedBaseAcomp) {
      return;
    }

    let precioTotal = selectedProduct.precio;
    let baseAcompNombre: string | null = null;
    const extrasNombres: string[] = [];

    if (selectedBaseAcomp) {
      const acomp = acompanamientos.find(a => a.id === selectedBaseAcomp);
      baseAcompNombre = acomp?.nombre || null;
    }

    for (const extraId of selectedExtras) {
      const extra = acompanamientos.find(a => a.id === extraId);
      if (extra) {
        precioTotal += extra.recargo;
        extrasNombres.push(extra.nombre);
      }
    }

    const item: CartItem = {
      id: generateId(),
      producto: selectedProduct,
      cantidad: 1,
      baseAcomp: baseAcompNombre,
      extras: extrasNombres,
      precioTotal,
    };

    cartItems = [...cartItems, item];
    closeAcompModal();
    showCart = true;
  }

  function removeFromCart(itemId: string) {
    cartItems = cartItems.filter(i => i.id !== itemId);
  }

  function getCartTotal(): number {
    return cartItems.reduce((sum, i) => sum + i.precioTotal * i.cantidad, 0);
  }

  function handleProductClick(producto: Producto) {
    const hasAcompanamientos = getAcompForProducto(producto.id).length > 0;
    if (hasAcompanamientos) {
      openAcompModal(producto);
    } else {
      cartItems = [...cartItems, {
        id: generateId(),
        producto,
        cantidad: 1,
        baseAcomp: null,
        extras: [],
        precioTotal: producto.precio,
      }];
      showCart = true;
    }
  }

  async function submitOrder() {
    if (cartItems.length === 0) return;

    orderError = '';
    const total = getCartTotal();

    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          piso,
          mesa,
          items: cartItems.map(i => ({
            producto_id: i.producto.id,
            cantidad: i.cantidad,
            acompanamiento: [
              i.baseAcomp,
              ...i.extras,
            ].filter(Boolean).join(', ') || null,
            subtotal: i.precioTotal * i.cantidad,
          })),
          total,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        orderError = err.error || 'Error al enviar el pedido';
        return;
      }

      cartItems = [];
      showCart = false;
      showSuccess = true;
      setTimeout(() => { showSuccess = false; }, 5000);
    } catch (e) {
      orderError = 'Error de conexión. Intenta de nuevo.';
    }
  }

  let filteredProductos: Producto[] = $state([]);

  $effect(() => {
    filteredProductos = activeCategoria ? getProductosByCategoria(activeCategoria) : [];
  });
</script>

<div class="max-w-4xl mx-auto px-4 pb-24">
  <!-- Header -->
  <header class="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 py-3 mb-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-brand-700">La Cascada</h1>
        <p class="text-xs text-gray-500">Piso {piso} · Mesa {mesa}</p>
      </div>
      <button
        class="relative btn-primary flex items-center gap-2"
        on:click={() => { showCart = !showCart; showSuccess = false; }}
      >
        🛒
        <span class="hidden sm:inline">Pedido</span>
        {#if cartItems.length > 0}
          <span class="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {cartItems.length}
          </span>
        {/if}
      </button>
    </div>
  </header>

  {#if loading}
    <div class="flex justify-center py-20">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
    </div>
  {:else}
    <!-- Category Tabs -->
    <nav class="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
      {#each categorias as cat}
        <button
          class="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors
            {activeCategoria === cat.id
              ? 'bg-brand-600 text-white'
              : 'bg-white text-gray-700 border border-gray-200 hover:border-brand-300'}"
          on:click={() => { activeCategoria = cat.id }}
        >
          {cat.nombre}
        </button>
      {/each}
    </nav>

    <!-- Products Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {#each filteredProductos as producto (producto.id)}
        <button
          class="text-left card hover:shadow-md transition-all cursor-pointer w-full"
          on:click={() => handleProductClick(producto)}
        >
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-semibold text-gray-900 pr-2">{producto.nombre}</h3>
            <span class="text-brand-700 font-bold whitespace-nowrap">
              ${producto.precio.toLocaleString('es-CL')}
            </span>
          </div>
          {#if producto.ingredientes}
            <p class="text-sm text-gray-500 mb-2">{producto.ingredientes}</p>
          {/if}
          {#if producto.maneja_stock}
            <span class="text-xs text-gray-400">Stock: {producto.stock_actual} disponibles</span>
          {/if}
        </button>
      {/each}
    </div>

    {#if filteredProductos.length === 0}
      <div class="text-center py-12 text-gray-500">
        No hay productos disponibles en esta categoría por el momento.
      </div>
    {/if}
  {/if}
</div>

<!-- Cart Panel -->
{#if showCart}
  <Cart
    {cartItems}
    {acompanamientos}
    {orderError}
    on:remove={(e) => removeFromCart(e.detail)}
    on:submit={submitOrder}
    on:close={() => { showCart = false }}
    total={getCartTotal()}
  />
{/if}

<!-- Accompaniment Modal -->
{#if showAcompModal && selectedProduct}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog">
    <div class="absolute inset-0 bg-black/50" on:click={closeAcompModal}></div>
    <div class="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] overflow-y-auto p-6 z-10">
      <h3 class="text-lg font-bold text-gray-900 mb-1">{selectedProduct.nombre}</h3>
      <p class="text-brand-700 font-semibold mb-4">${selectedProduct.precio.toLocaleString('es-CL')}</p>

      {#if getBaseAcomp(selectedProduct.id).length > 0}
        <div class="mb-4">
          <h4 class="text-sm font-semibold text-gray-700 mb-2">Elige un acompañamiento:</h4>
          <div class="space-y-2">
            {#each getBaseAcomp(selectedProduct.id) as acomp (acomp.id)}
              <label class="flex items-center gap-3 p-2 rounded-lg border cursor-pointer
                {selectedBaseAcomp === acomp.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}">
                <input
                  type="radio"
                  name="baseAcomp"
                  value={acomp.id}
                  checked={selectedBaseAcomp === acomp.id}
                  on:change={() => { selectedBaseAcomp = acomp.id }}
                  class="text-brand-600"
                />
                <span class="flex-1 text-sm">{acomp.nombre}</span>
              </label>
            {/each}
          </div>
        </div>
      {/if}

      {#if getExtraAcomp(selectedProduct.id).length > 0}
        <div class="mb-4">
          <h4 class="text-sm font-semibold text-gray-700 mb-2">Extras (con recargo):</h4>
          <div class="space-y-2">
            {#each getExtraAcomp(selectedProduct.id) as extra (extra.id)}
              <label class="flex items-center gap-3 p-2 rounded-lg border cursor-pointer
                {selectedExtras.includes(extra.id) ? 'border-brand-500 bg-brand-50' : 'border-gray-200'}">
                <input
                  type="checkbox"
                  checked={selectedExtras.includes(extra.id)}
                  on:change={(e) => {
                    if (e.target.checked) {
                      selectedExtras = [...selectedExtras, extra.id];
                    } else {
                      selectedExtras = selectedExtras.filter(id => id !== extra.id);
                    }
                  }}
                  class="text-brand-600 rounded"
                />
                <span class="flex-1 text-sm">{extra.nombre}</span>
                <span class="text-sm text-brand-600 font-medium">+${extra.recargo.toLocaleString('es-CL')}</span>
              </label>
            {/each}
          </div>
        </div>
      {/if}

      {#if selectedBaseAcomp || getBaseAcomp(selectedProduct.id).length === 0}
        <button class="btn-primary w-full" on:click={addToCart}>
          Agregar al pedido
          {#if selectedExtras.length > 0 || (selectedBaseAcomp && acompanamientos.find(a => a.id === selectedBaseAcomp)?.recargo)}
            - ${(selectedProduct.precio + selectedExtras.reduce((sum, id) => {
              const extra = acompanamientos.find(a => a.id === id);
              return sum + (extra?.recargo || 0);
            }, 0)).toLocaleString('es-CL')}
          {/if}
        </button>
      {:else}
        <p class="text-sm text-red-500 text-center">Selecciona un acompañamiento base</p>
      {/if}
    </div>
  </div>
{/if}

<!-- Success Toast -->
{#if showSuccess}
  <div class="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50">
    <div class="bg-green-600 text-white rounded-xl p-4 shadow-lg flex items-center gap-3">
      <span class="text-2xl">✓</span>
      <div>
        <p class="font-semibold">¡Pedido enviado!</p>
        <p class="text-sm text-green-100">Tu pedido está siendo procesado</p>
      </div>
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
