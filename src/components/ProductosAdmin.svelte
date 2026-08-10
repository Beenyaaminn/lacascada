<script lang="ts">
  import { onMount } from 'svelte';
  import { type Producto, type Categoria } from '../lib/types';

  type CategoriaConTotal = Categoria & { total_productos?: number };

  let productos: Producto[] = $state([]);
  let categorias: CategoriaConTotal[] = $state([]);
  let loading: boolean = $state(true);
  let showModal: boolean = $state(false);
  let editingId: number | null = $state(null);
  let nuevaCategoria: string = $state('');
  let savingCategoria: boolean = $state(false);

  let form = $state({
    categoria_id: 1,
    nombre: '',
    descripcion: '',
    precio: 0,
    ingredientes: '',
    maneja_stock: false,
    stock_actual: 0,
    disponible_dia: true,
  });

  let message: string = $state('');
  let error: string = $state('');

  onMount(() => {
    loadData();
  });

  async function loadData() {
    loading = true;
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/admin/productos'),
        fetch('/api/admin/categorias'),
      ]);

      const prodData = await prodRes.json();
      const catData = await catRes.json();

      productos = prodData.productos || [];
      categorias = catData.categorias || [];
    } catch (e) {
      error = 'Error al cargar datos';
    } finally {
      loading = false;
    }
  }

  function openCreate() {
    editingId = null;
    form = { categoria_id: categorias[0]?.id ?? 1, nombre: '', descripcion: '', precio: 0, ingredientes: '', maneja_stock: false, stock_actual: 0, disponible_dia: true };
    showModal = true;
  }

  async function handleCreateCategoria() {
    if (savingCategoria) return;
    const nombre = nuevaCategoria.trim();
    if (!nombre) {
      error = 'Ingresa un nombre para la categoría';
      return;
    }
    error = '';
    message = '';
    savingCategoria = true;

    try {
      const res = await fetch('/api/admin/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });

      if (!res.ok) {
        const err = await res.json();
        error = err.error || 'Error al crear categoría';
        return;
      }

      nuevaCategoria = '';
      message = 'Categoría creada';
      loadData();
      setTimeout(() => { message = ''; }, 3000);
    } catch (e) {
      error = 'Error de conexión';
    } finally {
      savingCategoria = false;
    }
  }

  async function handleDeleteCategoria(cat: CategoriaConTotal) {
    if (!confirm(`¿Eliminar la categoría "${cat.nombre}"?`)) return;
    error = '';
    message = '';

    try {
      const res = await fetch(`/api/admin/categorias?id=${cat.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        error = err.error || 'Error al eliminar categoría';
        return;
      }
      message = 'Categoría eliminada';
      loadData();
      setTimeout(() => { message = ''; }, 3000);
    } catch (e) {
      error = 'Error de conexión';
    }
  }

  function openEdit(p: Producto) {
    editingId = p.id;
    form = {
      categoria_id: p.categoria_id,
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      precio: p.precio,
      ingredientes: p.ingredientes || '',
      maneja_stock: p.maneja_stock,
      stock_actual: p.stock_actual,
      disponible_dia: p.disponible_dia,
    };
    showModal = true;
  }

  let saving: boolean = $state(false);

  async function handleSave() {
    if (saving) return;
    error = '';
    message = '';
    saving = true;

    const url = '/api/admin/productos';
    const method = editingId ? 'PUT' : 'POST';
    const body = editingId ? { ...form, id: editingId } : form;

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        error = err.error || 'Error al guardar';
        return;
      }

      message = editingId ? 'Producto actualizado' : 'Producto creado';
      showModal = false;
      loadData();
      setTimeout(() => { message = ''; }, 3000);
    } catch (e) {
      error = 'Error de conexión';
    } finally {
      saving = false;
    }
  }

  async function handleDelete(id: number, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;

    try {
      const res = await fetch(`/api/admin/productos?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        message = 'Producto eliminado';
        loadData();
        setTimeout(() => { message = ''; }, 3000);
      }
    } catch (e) {
      error = 'Error al eliminar';
    }
  }

  async function toggleDisponible(producto: Producto) {
    try {
      const res = await fetch('/api/admin/productos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: producto.id,
          categoria_id: producto.categoria_id,
          nombre: producto.nombre,
          descripcion: producto.descripcion || '',
          precio: producto.precio,
          ingredientes: producto.ingredientes || '',
          maneja_stock: producto.maneja_stock,
          stock_actual: producto.stock_actual,
          disponible_dia: !producto.disponible_dia,
        }),
      });
      if (res.ok) loadData();
    } catch (e) {
      error = 'Error al actualizar';
    }
  }
</script>

<div class="max-w-7xl mx-auto px-4 py-6">
  <div class="flex items-center justify-between mb-6">
    <h2 class="text-2xl font-bold text-gray-900">Gestión de Productos</h2>
    <button class="btn-primary" on:click={openCreate}>+ Nuevo Producto</button>
  </div>

  {#if message}
    <div class="bg-green-100 text-green-800 rounded-lg p-3 mb-4 text-sm">{message}</div>
  {/if}
  {#if error}
    <div class="bg-red-100 text-red-800 rounded-lg p-3 mb-4 text-sm">{error}</div>
  {/if}

  {#if loading}
    <div class="text-center py-12 text-gray-500">Cargando...</div>
  {:else}
    <!-- Gestión de categorías -->
    <div class="card p-4 mb-6">
      <h3 class="text-base font-bold text-gray-900 mb-3">Categorías</h3>

      <form class="flex gap-2 mb-4" on:submit|preventDefault={handleCreateCategoria}>
        <input
          class="input-field flex-1"
          bind:value={nuevaCategoria}
          placeholder="Nombre de la nueva categoría"
        />
        <button type="submit" class="btn-primary whitespace-nowrap" disabled={savingCategoria}>
          {savingCategoria ? 'Creando...' : '+ Crear categoría'}
        </button>
      </form>

      <ul class="divide-y divide-gray-100">
        {#each categorias as cat (cat.id)}
          <li class="flex items-center justify-between py-2">
            <div class="flex items-center gap-3">
              <span class="font-medium text-gray-900 text-sm">{cat.nombre}</span>
              <span class="text-xs text-gray-400">orden {cat.orden}</span>
              <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {cat.total_productos ?? 0} producto(s)
              </span>
            </div>
            <button
              class="text-red-600 hover:text-red-800 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={(cat.total_productos ?? 0) > 0}
              title={(cat.total_productos ?? 0) > 0 ? 'No se puede eliminar: tiene productos asociados' : 'Eliminar categoría'}
              on:click={() => handleDeleteCategoria(cat)}
            >
              Eliminar
            </button>
          </li>
        {/each}
        {#if categorias.length === 0}
          <li class="py-3 text-sm text-gray-500">No hay categorías. Crea la primera arriba.</li>
        {/if}
      </ul>
    </div>

    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="text-left p-3 font-medium text-gray-600">Producto</th>
              <th class="text-left p-3 font-medium text-gray-600">Categoría</th>
              <th class="text-right p-3 font-medium text-gray-600">Precio</th>
              <th class="text-center p-3 font-medium text-gray-600">Stock</th>
              <th class="text-center p-3 font-medium text-gray-600">Disponible</th>
              <th class="text-right p-3 font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            {#each productos as p (p.id)}
              <tr class="hover:bg-gray-50">
                <td class="p-3">
                  <p class="font-medium text-gray-900">{p.nombre}</p>
                  {#if p.ingredientes}
                    <p class="text-xs text-gray-500 mt-0.5">{p.ingredientes}</p>
                  {/if}
                </td>
                <td class="p-3 text-gray-600">{p.categoria_nombre}</td>
                <td class="p-3 text-right font-medium">${p.precio.toLocaleString('es-CL')}</td>
                <td class="p-3 text-center">
                  {#if p.maneja_stock}
                    <span class="inline-flex items-center gap-1">
                      <span class="font-medium">{p.stock_actual}</span>
                      <span class="text-xs text-gray-400">unid.</span>
                    </span>
                  {:else}
                    <span class="text-xs text-gray-400">N/A</span>
                  {/if}
                </td>
                <td class="p-3 text-center">
                  <button
                    class="px-2 py-1 rounded text-xs font-medium cursor-pointer {p.disponible_dia ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}"
                    on:click={() => toggleDisponible(p)}
                  >
                    {p.disponible_dia ? 'Sí' : 'No'}
                  </button>
                </td>
                <td class="p-3 text-right">
                  <div class="flex gap-2 justify-end">
                    <button class="text-blue-600 hover:text-blue-800 text-xs font-medium" on:click={() => openEdit(p)}>Editar</button>
                    <button class="text-red-600 hover:text-red-800 text-xs font-medium" on:click={() => handleDelete(p.id, p.nombre)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<!-- Modal -->
{#if showModal}
  <div class="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
    <div class="absolute inset-0 bg-black/50" on:click={() => { showModal = false }}></div>
    <div class="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 z-10">
      <h3 class="text-lg font-bold mb-4">{editingId ? 'Editar Producto' : 'Nuevo Producto'}</h3>

      <form class="space-y-3" on:submit|preventDefault={handleSave}>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
          <select class="input-field" bind:value={form.categoria_id}>
            {#each categorias as cat}
              <option value={cat.id}>{cat.nombre}</option>
            {/each}
          </select>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
          <input class="input-field" bind:value={form.nombre} required />
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
          <textarea class="input-field" rows="2" bind:value={form.descripcion}></textarea>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Precio ($)</label>
            <input class="input-field" type="number" bind:value={form.precio} min="0" required />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1">Ingredientes</label>
            <input class="input-field" bind:value={form.ingredientes} placeholder="Separados por coma" />
          </div>
        </div>

        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" bind:checked={form.maneja_stock} class="rounded text-brand-600" />
            <span class="text-sm text-gray-700">Maneja stock físico</span>
          </label>

          {#if form.maneja_stock}
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Stock actual</label>
              <input class="input-field w-24" type="number" bind:value={form.stock_actual} min="0" />
            </div>
          {/if}
        </div>

        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" bind:checked={form.disponible_dia} class="rounded text-brand-600" />
          <span class="text-sm text-gray-700">Disponible hoy</span>
        </label>

        <div class="flex gap-3 pt-3">
          <button type="button" class="btn-secondary flex-1" on:click={() => { showModal = false }}>Cancelar</button>
          <button type="submit" class="btn-primary flex-1" disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}</button>
        </div>
      </form>
    </div>
  </div>
{/if}
