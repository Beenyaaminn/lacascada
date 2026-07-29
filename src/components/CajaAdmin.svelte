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
</div>
