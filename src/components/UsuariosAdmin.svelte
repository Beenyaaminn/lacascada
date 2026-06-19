<script lang="ts">
  import { onMount } from 'svelte';

  let usuarios: any[] = $state([]);
  let loading: boolean = $state(true);
  let showModal: boolean = $state(false);
  let editando: any | null = $state(null);
  let nombre: string = $state('');
  let email: string = $state('');
  let password: string = $state('');
  let rol: string = $state('garzon');
  let error: string = $state('');
  let saving: boolean = $state(false);

  onMount(() => { loadUsuarios(); });

  async function loadUsuarios() {
    loading = true;
    try {
      const res = await fetch('/api/admin/usuarios');
      const data = await res.json();
      usuarios = data.usuarios || [];
    } catch (e) { /* */ }
    finally { loading = false; }
  }

  function openNuevo() {
    editando = null;
    nombre = ''; email = ''; password = ''; rol = 'garzon'; error = '';
    showModal = true;
  }

  function openEditar(u: any) {
    editando = u;
    nombre = u.nombre; email = u.email; password = ''; rol = u.rol; error = '';
    showModal = true;
  }

  async function guardar() {
    if (!nombre.trim() || !email.trim()) { error = 'Nombre y email son obligatorios'; return; }
    if (!editando && !password) { error = 'La contraseña es obligatoria'; return; }
    saving = true; error = '';
    try {
      const method = editando ? 'PUT' : 'POST';
      const body: any = editando ? { id: editando.id, nombre, email, rol } : { nombre, email, password, rol };
      if (editando && password) body.password = password;
      const res = await fetch('/api/admin/usuarios', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        showModal = false;
        loadUsuarios();
      } else {
        error = data.error || 'Error al guardar';
      }
    } catch (e) { error = 'Error de conexión'; }
    finally { saving = false; }
  }

  function getRolBadge(r: string): string {
    if (r === 'admin') return 'bg-purple-100 text-purple-700';
    if (r === 'garzon') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-700';
  }
</script>

<div class="p-4 sm:p-6">
  <div class="flex items-center justify-between mb-6">
    <h2 class="text-xl font-bold text-gray-900">Usuarios</h2>
    <button class="btn-primary text-sm" onclick={openNuevo}>+ Nuevo Usuario</button>
  </div>

  {#if loading}
    <div class="text-center py-12 text-gray-500">Cargando...</div>
  {:else}
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-100 text-left">
            <th class="p-3 font-medium text-gray-500">Nombre</th>
            <th class="p-3 font-medium text-gray-500">Email</th>
            <th class="p-3 font-medium text-gray-500">Rol</th>
            <th class="p-3 font-medium text-gray-500 text-right">Acción</th>
          </tr>
        </thead>
        <tbody>
          {#each usuarios as u (u.id)}
            <tr class="border-b border-gray-50 hover:bg-gray-50">
              <td class="p-3 font-medium text-gray-900">{u.nombre}</td>
              <td class="p-3 text-gray-500">{u.email}</td>
              <td class="p-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium {getRolBadge(u.rol)}">{u.rol}</span></td>
              <td class="p-3 text-right"><button class="text-brand-600 hover:text-brand-700 text-xs font-medium" onclick={() => openEditar(u)}>Editar</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Modal -->
{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
    <div class="absolute inset-0 bg-black/50" onclick={() => { showModal = false }}></div>
    <div class="relative bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 z-10">
      <h3 class="text-lg font-bold mb-4">{editando ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
      <div class="space-y-4 mb-4">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input type="text" bind:value={nombre} class="input-field" placeholder="Nombre completo" /></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Email</label><input type="email" bind:value={email} class="input-field" placeholder="correo@ejemplo.com" /></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Contraseña {editando ? '(dejar vacío para mantener)' : ''}</label><input type="password" bind:value={password} class="input-field" placeholder="••••••••" /></div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Rol</label>
          <div class="grid grid-cols-3 gap-2">
            {#each ['admin', 'garzon', 'cliente'] as r}
              <label class="flex items-center justify-center gap-1 p-2 rounded-lg border cursor-pointer text-sm {rol === r ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}">
                <input type="radio" bind:group={rol} value={r} class="sr-only" />
                <span class="capitalize">{r}</span>
              </label>
            {/each}
          </div>
        </div>
      </div>
      {#if error}<div class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>{/if}
      <div class="flex gap-3">
        <button class="btn-secondary flex-1" onclick={() => { showModal = false }}>Cancelar</button>
        <button class="btn-primary flex-1" onclick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </div>
  </div>
{/if}
