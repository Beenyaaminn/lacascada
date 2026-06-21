<script lang="ts">
  import { onMount } from 'svelte';
  import { type ClienteCredito, type Abono } from '../lib/types';

  let clientes: ClienteCredito[] = $state([]);
  let loading: boolean = $state(true);
  let showModal: boolean = $state(false);
  let editingId: number | null = $state(null);
  let showAbonoModal: boolean = $state(false);
  let selectedCliente: ClienteCredito | null = $state(null);
  let abonos: Abono[] = $state([]);
  let montoAbono: number = $state(0);

  let form = $state({ nombre: '', rut_o_telefono: '', limite_credito: 0 });
  let message: string = $state('');

  onMount(() => { loadClientes(); });

  async function loadClientes() {
    loading = true;
    try {
      const res = await fetch('/api/admin/clientes');
      const data = await res.json();
      clientes = data.clientes || [];
    } catch (e) { console.error(e); }
    finally { loading = false; }
  }

  function openCreate() {
    editingId = null;
    form = { nombre: '', rut_o_telefono: '', limite_credito: 0 };
    showModal = true;
  }

  function openEdit(c: ClienteCredito) {
    editingId = c.id;
    form = { nombre: c.nombre, rut_o_telefono: c.rut_o_telefono, limite_credito: c.limite_credito };
    showModal = true;
  }

  async function handleSave() {
    try {
      const url = '/api/admin/clientes';
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { ...form, id: editingId, activo: true } : form;

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        showModal = false;
        loadClientes();
        message = editingId ? 'Actualizado' : 'Creado';
        setTimeout(() => { message = ''; }, 3000);
      } else {
        alert(data.error || 'Error al guardar');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    }
  }

  async function openAbonos(cliente: ClienteCredito) {
    selectedCliente = cliente;
    montoAbono = 0;
    try {
      const res = await fetch(`/api/admin/clientes/${cliente.id}/abonos`);
      const data = await res.json();
      abonos = data.abonos || [];
    } catch (e) { abonos = []; }
    showAbonoModal = true;
  }

  async function registrarAbono() {
    if (!selectedCliente || montoAbono <= 0) return;
    try {
      const res = await fetch(`/api/admin/clientes/${selectedCliente.id}/abonos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: montoAbono }),
      });
      const data = await res.json();
      if (res.ok) {
        showAbonoModal = false;
        loadClientes();
        message = 'Abono registrado';
        setTimeout(() => { message = ''; }, 3000);
      } else {
        alert(data.error || 'Error al registrar abono');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    }
  }
</script>

<div class="max-w-7xl mx-auto px-4 py-6">
  <div class="flex items-center justify-between mb-6">
    <h2 class="text-2xl font-bold text-gray-900">Clientes con Crédito</h2>
    <button class="btn-primary" on:click={openCreate}>+ Nuevo Cliente</button>
  </div>

  {#if message}
    <div class="bg-green-100 text-green-800 rounded-lg p-3 mb-4 text-sm">{message}</div>
  {/if}

  {#if loading}
    <div class="text-center py-12 text-gray-500">Cargando...</div>
  {:else if clientes.length === 0}
    <div class="text-center py-12 text-gray-500">No hay clientes registrados</div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each clientes as c (c.id)}
        <div class="card p-4">
          <div class="flex justify-between items-start mb-2">
            <h3 class="font-bold text-gray-900">{c.nombre}</h3>
            <span class="text-xs px-2 py-0.5 rounded-full {c.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
              {c.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p class="text-sm text-gray-500">{c.rut_o_telefono}</p>
          <div class="mt-3 space-y-1">
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Límite:</span>
              <span class="font-medium">${c.limite_credito.toLocaleString('es-CL')}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Deuda:</span>
              <span class="font-medium {c.saldo_deudor > 0 ? 'text-red-600' : 'text-green-600'}">
                ${c.saldo_deudor.toLocaleString('es-CL')}
              </span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-500">Disponible:</span>
              <span class="font-medium text-brand-600">
                ${Math.max(0, c.limite_credito - c.saldo_deudor).toLocaleString('es-CL')}
              </span>
            </div>
          </div>
          <div class="flex gap-2 mt-3 pt-3 border-t border-gray-100">
            <button class="text-xs text-blue-600 hover:text-blue-800" on:click={() => openEdit(c)}>Editar</button>
            <button class="text-xs text-brand-600 hover:text-brand-800" on:click={() => openAbonos(c)}>Abonos</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Create/Edit Modal -->
{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
    <div class="absolute inset-0 bg-black/50" on:click={() => { showModal = false }}></div>
    <div class="relative bg-white rounded-2xl w-full max-w-md p-6 z-10">
      <h3 class="text-lg font-bold mb-4">{editingId ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
          <input class="input-field" bind:value={form.nombre} required />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">RUT o Teléfono</label>
          <input class="input-field" bind:value={form.rut_o_telefono} required />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Límite de Crédito ($)</label>
          <input class="input-field" type="number" bind:value={form.limite_credito} min="0" />
        </div>
        <div class="flex gap-3 pt-3">
          <button class="btn-secondary flex-1" on:click={() => { showModal = false }}>Cancelar</button>
          <button class="btn-primary flex-1" on:click={handleSave}>{editingId ? 'Actualizar' : 'Crear'}</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Abonos Modal -->
{#if showAbonoModal && selectedCliente}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
    <div class="absolute inset-0 bg-black/50" on:click={() => { showAbonoModal = false }}></div>
    <div class="relative bg-white rounded-2xl w-full max-w-md p-6 z-10">
      <h3 class="text-lg font-bold mb-2">Abonos - {selectedCliente.nombre}</h3>
      <p class="text-sm text-gray-500 mb-4">Deuda actual: <span class="font-bold text-red-600">${selectedCliente.saldo_deudor.toLocaleString('es-CL')}</span></p>

      <div class="flex gap-2 mb-4">
        <input class="input-field" type="number" bind:value={montoAbono} min="1" placeholder="Monto del abono $" />
        <button class="btn-primary whitespace-nowrap" on:click={registrarAbono}>Registrar</button>
      </div>

      {#if abonos.length > 0}
        <div class="border-t pt-3">
          <h4 class="text-sm font-semibold mb-2">Historial de Abonos</h4>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            {#each abonos as a (a.id)}
              <div class="flex justify-between text-sm bg-gray-50 rounded p-2">
                <span class="text-gray-500">{new Date(a.fecha_hora).toLocaleString('es-CL')}</span>
                <span class="font-medium text-green-600">${a.monto.toLocaleString('es-CL')}</span>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <p class="text-sm text-gray-400 text-center py-2">Sin abonos registrados</p>
      {/if}
    </div>
  </div>
{/if}
