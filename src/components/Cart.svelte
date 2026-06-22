<script lang="ts">
  import { type Acompanamiento } from '../lib/types';
  import { createEventDispatcher } from 'svelte';

  interface CartItem {
    id: string;
    producto: { id: number; nombre: string };
    cantidad: number;
    baseAcomp: string | null;
    extras: string[];
    precioTotal: number;
  }

  let { cartItems = [], acompanamientos = [], total = 0, orderError = '' } = $props<{
    cartItems?: CartItem[];
    acompanamientos?: Acompanamiento[];
    total?: number;
    orderError?: string;
  }>();

  const dispatch = createEventDispatcher();
</script>

<div class="fixed inset-0 z-40 flex justify-end">
  <div class="absolute inset-0 bg-black/50" on:click={() => dispatch('close')}></div>

  <div class="relative bg-white w-full sm:w-96 h-full overflow-y-auto shadow-xl z-10 flex flex-col">
    <div class="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
      <h2 class="text-lg font-bold text-gray-900">Tu Pedido</h2>
      <button
        class="text-gray-400 hover:text-gray-600 text-2xl p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
        on:click={() => dispatch('close')}
      >
        ×
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      {#if cartItems.length === 0}
        <div class="text-center py-12 text-gray-500">
          <p class="text-4xl mb-3">🛒</p>
          <p>Tu carrito está vacío</p>
          <p class="text-sm mt-1">Selecciona productos del menú</p>
        </div>
      {:else}
        <div class="space-y-3">
          {#each cartItems as item (item.id)}
            <div class="bg-gray-50 rounded-lg p-3">
              <div class="flex justify-between items-start">
                <div class="flex-1 pr-2">
                  <p class="font-medium text-gray-900 text-sm">{item.producto.nombre}</p>
                  {#if item.baseAcomp}
                    <p class="text-xs text-gray-500 mt-0.5">{item.baseAcomp}</p>
                  {/if}
                </div>
                <div class="text-right">
                  <p class="font-semibold text-sm">${item.precioTotal.toLocaleString('es-CL')}</p>
                </div>
              </div>
              <button
                class="mt-2 text-xs text-red-500 hover:text-red-700 px-2 py-1 min-w-[44px]"
                on:click={() => dispatch('remove', item.id)}
              >
                Eliminar
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    {#if cartItems.length > 0}
      <div class="sticky bottom-0 bg-white border-t border-gray-200 p-4">
        <div class="flex justify-between items-center mb-3">
          <span class="text-gray-700 font-medium">Total</span>
          <span class="text-xl font-bold text-brand-700">${total.toLocaleString('es-CL')}</span>
        </div>

        {#if orderError}
          <p class="text-red-500 text-sm mb-2 text-center">{orderError}</p>
        {/if}

        <button
          class="btn-primary w-full py-3 text-lg"
          on:click={() => dispatch('submit')}
        >
          Enviar Pedido
        </button>
      </div>
    {/if}
  </div>
</div>
