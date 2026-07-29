<script lang="ts">
  import { onMount } from 'svelte';

  let activeTab: string = $state('proveedores');
  let loading: boolean = $state(true);

  let proveedores: any[] = $state([]);
  let searchTerm: string = $state('');
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let editingId: number | null = $state(null);

  let formNombre: string = $state('');
  let formActivo: boolean = $state(true);
  let formContacto: string = $state('');
  let formTelefono: string = $state('');
  let formEmail: string = $state('');
  let formDireccion: string = $state('');
  let formNotas: string = $state('');
  let showForm: boolean = $state(false);

  const tabs = [
    { id: 'proveedores', label: 'Proveedores', icon: '🏭' },
    { id: 'bodegas', label: 'Jerarquía de bodegas', icon: '🏗️' },
    { id: 'contabilidad', label: 'Contabilidad', icon: '📒' },
  ];

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && tabs.some(t => t.id === tabParam)) {
      activeTab = tabParam;
    }
    loadProveedores();
  });

  async function loadProveedores() {
    loading = true;
    try {
      const url = searchTerm
        ? `/api/admin/proveedores?search=${encodeURIComponent(searchTerm)}`
        : '/api/admin/proveedores';
      const res = await fetch(url);
      const data = await res.json();
      proveedores = data.proveedores || [];
    } catch (e) { console.error(e); }
    finally { loading = false; }
  }

  function openNewForm() {
    editingId = null;
    formNombre = ''; formActivo = true; formContacto = '';
    formTelefono = ''; formEmail = ''; formDireccion = ''; formNotas = '';
    showForm = true;
  }

  function openEditForm(p: any) {
    editingId = p.id;
    formNombre = p.nombre; formActivo = p.activo; formContacto = p.contacto || '';
    formTelefono = p.telefono || ''; formEmail = p.email || ''; formDireccion = p.direccion || ''; formNotas = p.notas || '';
    showForm = true;
  }

  function closeForm() { showForm = false; editingId = null; }

  let saving: boolean = $state(false);

  async function saveProveedor() {
    if (!formNombre.trim() || saving) return;
    saving = true;
    const body: any = { nombre: formNombre.trim(), activo: formActivo, contacto: formContacto, telefono: formTelefono, email: formEmail, direccion: formDireccion, notas: formNotas };

    try {
      let res;
      if (editingId) {
        res = await fetch('/api/admin/proveedores', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...body }),
        });
      } else {
        res = await fetch('/api/admin/proveedores', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      if (res.ok) {
        closeForm();
        loadProveedores();
      } else {
        const data = await res.json();
        alert(data.error || 'Error al guardar');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión al guardar');
    } finally {
      saving = false;
    }
  }

  async function eliminarProveedor(id: number) {
    if (!confirm('¿Eliminar este proveedor?')) return;
    try {
      const res = await fetch(`/api/admin/proveedores?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Error al eliminar');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión al eliminar');
    }
    loadProveedores();
  }

  async function toggleActivo(p: any) {
    try {
      const res = await fetch('/api/admin/proveedores', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, activo: !p.activo }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Error al cambiar estado');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
    }
    loadProveedores();
  }

  function formatCLP(n: number): string { return '$' + n.toLocaleString('es-CL'); }
</script>

<div class="p-4 sm:p-6">
  <h2 class="text-xl font-bold text-gray-900 mb-4">Stock Control</h2>

  <!-- Tabs -->
  <nav class="flex gap-1 mb-6 border-b border-gray-200">
    {#each tabs as tab}
      <button
        class="px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-[1px]
          {activeTab === tab.id ? 'border-brand-600 text-brand-700 bg-brand-50' : 'border-transparent text-gray-500 hover:text-gray-700'}"
        onclick={() => { activeTab = tab.id }}
      ><span class="mr-1.5">{tab.icon}</span>{tab.label}</button>
    {/each}
  </nav>

  {#if activeTab === 'proveedores'}
    <!-- Search + Add bar -->
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <div class="flex-1 min-w-[200px]">
        <input
          type="text" class="input-field" placeholder="Buscar proveedor..."
          bind:value={searchTerm}
          oninput={() => {
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => loadProveedores(), 350);
          }}
        />
      </div>
      <button class="btn-primary flex items-center gap-1.5" onclick={openNewForm}>
        <span class="text-lg">+</span> Agregar proveedor
      </button>
    </div>

    <!-- Table -->
    {#if loading}
      <p class="text-gray-400 text-center py-8">Cargando...</p>
    {:else if proveedores.length === 0}
      <p class="text-gray-400 text-center py-8">No se encontraron proveedores</p>
    {:else}
      <div class="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th class="px-4 py-3 w-16">ID</th>
              <th class="px-4 py-3 w-20">Activo</th>
              <th class="px-4 py-3">Nombre</th>
              <th class="px-4 py-3 hidden sm:table-cell">Contacto</th>
              <th class="px-4 py-3 hidden md:table-cell">Teléfono</th>
              <th class="px-4 py-3 w-24">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {#each proveedores as p (p.id)}
              <tr class="hover:bg-gray-50 cursor-pointer" onclick={() => openEditForm(p)}>
                <td class="px-4 py-3 font-mono text-gray-500">#{p.id}</td>
                <td class="px-4 py-3">
                  <button
                    class="text-xs px-2 py-0.5 rounded-full font-medium {p.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}"
                    onclick={(e) => { e.stopPropagation(); toggleActivo(p); }}
                  >{p.activo ? 'Sí' : 'No'}</button>
                </td>
                <td class="px-4 py-3 font-medium text-gray-900">{p.nombre}</td>
                <td class="px-4 py-3 text-gray-500 hidden sm:table-cell">{p.contacto || '—'}</td>
                <td class="px-4 py-3 text-gray-500 hidden md:table-cell">{p.telefono || '—'}</td>
                <td class="px-4 py-3">
                  <button
                    class="text-xs text-red-500 hover:text-red-700 font-medium"
                    onclick={(e) => { e.stopPropagation(); eliminarProveedor(p.id); }}
                  >Eliminar</button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- Add / Edit Modal -->
    {#if showForm}
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" onclick={closeForm}></div>
        <div class="relative bg-white rounded-2xl w-full max-w-md shadow-xl z-10 p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">{editingId ? 'Editar' : 'Agregar'} Proveedor</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Nombre</label>
              <input class="input-field" bind:value={formNombre} placeholder="Nombre del proveedor" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">Contacto</label>
                <input class="input-field" bind:value={formContacto} placeholder="Persona" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">Teléfono</label>
                <input class="input-field" bind:value={formTelefono} placeholder="+56..." />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Email</label>
              <input type="email" class="input-field" bind:value={formEmail} placeholder="correo@ejemplo.com" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Dirección</label>
              <input class="input-field" bind:value={formDireccion} placeholder="Dirección" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1">Notas</label>
              <textarea class="input-field h-16 resize-none" bind:value={formNotas} placeholder="Notas adicionales"></textarea>
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" id="activoCheck" bind:checked={formActivo} class="rounded" />
              <label for="activoCheck" class="text-sm text-gray-700">Activo</label>
            </div>
          </div>
          <div class="flex gap-3 mt-5">
            <button class="flex-1 btn-secondary py-2" onclick={closeForm}>Cancelar</button>
            <button class="flex-1 btn-primary py-2" disabled={saving} onclick={saveProveedor}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    {/if}

  {:else if activeTab === 'bodegas'}
    <div class="text-center py-16 text-gray-400">
      <p class="text-lg font-medium">Jerarquía de Bodegas</p>
      <p class="text-sm mt-1">Próximamente</p>
    </div>

  {:else if activeTab === 'contabilidad'}
    <div class="text-center py-16 text-gray-400">
      <p class="text-lg font-medium">Contabilidad</p>
      <p class="text-sm mt-1">Próximamente</p>
    </div>
  {/if}
</div>
