<script lang="ts">
  import type { Producto } from '../lib/types';
  import { createEventDispatcher } from 'svelte';

  let { producto } = $props<{ producto: Producto }>();
  const dispatch = createEventDispatcher();
</script>

<button
  class="text-left card hover:shadow-md transition-all cursor-pointer w-full"
  on:click={() => dispatch('click')}
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
