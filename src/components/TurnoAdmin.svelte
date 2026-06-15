<script lang="ts">
  import { onMount } from 'svelte';

  let tipoSeleccionado: string = $state('manana');
  let comentarios: string = $state('');
  let soloHoy: boolean = $state(true);
  let fechaHoy: string = $state(new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }));
  let loading: boolean = $state(false);
  let error: string = $state('');
  let turnoAbierto: any | null = $state(null);
  let turnoActivo: any | null = $state(null);
  let modoCerrar: boolean = $state(false);

  const turnos = [
    { id: 'manana', label: 'Turno Mañana' },
    { id: 'medio_dia', label: 'Turno Medio Día' },
    { id: 'noche', label: 'Turno Noche' },
  ];

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const cerrar = params.get('cerrar');
    try {
      const res = await fetch('/api/admin/turnos?activo=1');
      const data = await res.json();
      if (data.turnos?.length > 0) {
        turnoActivo = data.turnos[0];
        if (cerrar === '1') {
          modoCerrar = true;
        } else {
          turnoAbierto = data.turnos[0];
        }
      }
    } catch (e) { /* ignore */ }
  });

  function generarIdPreview(): string {
    const now = new Date();
    const seq = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
    const mapa: Record<string, string> = { manana: 'MAN', medio_dia: 'MED', noche: 'NOC' };
    return `${mapa[tipoSeleccionado]}-${seq}`;
  }

  function tipoLabel(t: string): string {
    const tObj = turnos.find(x => x.id === t);
    return tObj ? tObj.label : t;
  }

  async function abrirTurno() {
    loading = true;
    error = '';
    try {
      const res = await fetch('/api/admin/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_turno: tipoSeleccionado, comentarios, solo_hoy: soloHoy }),
      });
      const data = await res.json();
      if (res.ok) {
        window.location.href = '/admin/turno';
      } else {
        error = data.error || 'Error al abrir turno';
      }
    } catch (e) {
      error = 'Error de conexión';
    } finally {
      loading = false;
    }
  }

  function nuevoTurno() {
    turnoAbierto = null;
    error = '';
    comentarios = '';
  }

  async function cerrarTurno() {
    if (!turnoActivo) return;
    if (!confirm('¿Cerrar el turno #' + turnoActivo.id + '?')) return;
    loading = true;
    try {
      const res = await fetch('/api/admin/turnos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: turnoActivo.id, estado: 'cerrado' }),
      });
      if (res.ok) {
        window.location.href = '/admin';
      } else {
        const data = await res.json();
        error = data.error || 'Error al cerrar turno';
      }
    } catch (e) {
      error = 'Error de conexión';
    } finally {
      loading = false;
    }
  }
</script>

<div class="p-4 sm:p-6 max-w-lg mx-auto">
  <h2 class="text-xl font-bold text-gray-900 mb-6">Abrir Turno</h2>

  {#if turnoAbierto}
    <!-- Confirmación -->
    <div class="card p-8 text-center">
      <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
      </div>
      <h3 class="text-lg font-bold text-gray-900 mb-2">¡Turno Abierto!</h3>
      <p class="text-gray-600 mb-1">{tipoLabel(turnoAbierto.tipo_turno)}</p>
      <p class="text-3xl font-bold text-brand-700 mb-4">#{turnoAbierto.id}</p>
      <p class="text-xs text-gray-400">Abierto por {turnoAbierto.abierto_por} &bull; {new Date(turnoAbierto.abierto_desde).toLocaleTimeString('es-CL')}</p>
      {#if turnoAbierto.comentarios}
        <p class="text-xs text-gray-500 mt-2 italic">"{turnoAbierto.comentarios}"</p>
      {/if}
      <button class="btn-primary mt-6 px-6" onclick={nuevoTurno}>Abrir otro turno</button>
    </div>

  {:else if turnoActivo && modoCerrar}
    <!-- Cerrar Turno -->
    <div class="card p-8 text-center">
      <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg class="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </div>
      <h3 class="text-lg font-bold text-gray-900 mb-2">Cerrar Turno</h3>
      <p class="text-gray-600 mb-1">{tipoLabel(turnoActivo.tipo_turno)}</p>
      <p class="text-3xl font-bold text-brand-700 mb-4">#{turnoActivo.id}</p>
      <p class="text-xs text-gray-400 mb-6">Abierto por {turnoActivo.abierto_por} &bull; {new Date(turnoActivo.abierto_desde).toLocaleString('es-CL')}</p>
      {#if error}
        <div class="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>
      {/if}
      <button class="btn-danger w-full py-3 disabled:opacity-50" disabled={loading} onclick={cerrarTurno}>
        {loading ? 'Cerrando...' : 'Cerrar Turno'}
      </button>
    </div>

  {:else if turnoActivo}
    <!-- Turno activo existente -->
    <div class="card p-6 text-center">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Turno Activo</h3>
      <p class="text-2xl font-bold text-brand-700 mb-2">#{turnoActivo.id}</p>
      <p class="text-gray-600">{tipoLabel(turnoActivo.tipo_turno)}</p>
      <p class="text-xs text-gray-400 mt-2">Abierto por {turnoActivo.abierto_por} &bull; {new Date(turnoActivo.abierto_desde).toLocaleString('es-CL')}</p>
    </div>

  {:else}
    <!-- Formulario -->
    <div class="card p-6 space-y-5">
      <!-- Turno actual + fecha -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">Turno actual</label>
          <p class="text-sm font-medium text-gray-900">{new Date().toLocaleDateString('es-CL', { weekday: 'long' }).replace(/^\w/, c => c.toUpperCase())}</p>
        </div>
        <div class="text-right">
          <label class="block text-xs font-semibold text-gray-500 mb-1">Fecha Turno</label>
          <p class="text-sm font-medium text-gray-900">{fechaHoy}</p>
        </div>
      </div>

      <!-- Solo turnos de este día -->
      <div class="flex items-center justify-between bg-gray-50 rounded-lg p-3">
        <span class="text-sm text-gray-700">Solo turnos de este día de la semana</span>
        <input type="checkbox" bind:checked={soloHoy} class="w-5 h-5 text-brand-600 rounded" />
      </div>

      <!-- Seleccione turno -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-2">Seleccione Turno a Abrir:</label>
        <div class="grid grid-cols-3 gap-2">
          {#each turnos as t}
            <button
              class="px-3 py-3 rounded-xl text-xs font-semibold text-center border-2 transition-colors
                {tipoSeleccionado === t.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}"
              onclick={() => { tipoSeleccionado = t.id }}
            >{t.label}</button>
          {/each}
        </div>
      </div>

      <!-- ID turno preview -->
      <div class="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
        <span class="text-sm font-semibold text-gray-700">ID Turno a abrir:</span>
        <div class="text-right">
          <span class="text-sm font-bold text-brand-700 font-mono">{generarIdPreview()}</span>
          <p class="text-xs text-gray-400">{tipoLabel(tipoSeleccionado)}</p>
        </div>
      </div>

      <!-- Comentarios -->
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-1.5">Comentarios</label>
        <textarea class="input-field h-16 resize-none" bind:value={comentarios} placeholder="Notas del turno..."></textarea>
      </div>

      {#if error}
        <div class="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>
      {/if}

      <button class="btn-primary w-full py-3 disabled:opacity-50" disabled={loading} onclick={abrirTurno}>
        {loading ? 'Abriendo...' : 'Abrir Turno'}
      </button>
    </div>
  {/if}
</div>
