'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  FileText, 
  RefreshCw, 
  Trash2, 
  Search, 
  X, 
  AlertCircle, 
  CheckSquare, 
  Square, 
  ChevronRight,
  ExternalLink,
  Plus,
  ArrowRight,
  Filter,
  Calendar,
  User,
  Building2,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Row = {
  id: string;
  created_at: string;
  obrero_nombre: string;
  obrero_cedula: string;
  proyecto_id: string;
  formalizado_empleado_id?: string | null;
  ci_proyectos?: { nombre: string } | { nombre: string }[] | null;
};

type SortConfig = {
  key: keyof Row | 'proyecto';
  direction: 'asc' | 'desc' | null;
};

function getNombreProyecto(r: Row): string {
  const p = r.ci_proyectos;
  if (p == null) return r.proyecto_id?.slice(0, 8) ?? '—';
  const o = Array.isArray(p) ? p[0] : p;
  const n = (o as any)?.nombre?.trim();
  return n || r.proyecto_id?.slice(0, 8) || '—';
}

export function ContratosExpressListaTalento() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'formalized'>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  
  // Deletion Dialog State
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, nombre: string, formalizado: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setSelectedIds(new Set());
    
    try {
      const res = await fetch('/api/talento/contratos-express');
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Error al recuperar listado administrativo');
      }
      const data = await res.json();
      setRows(data as Row[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Fallo crítico de enlace con el servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSort = (key: SortConfig['key']) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredAndSortedRows = useMemo(() => {
    let result = [...rows];

    // Status Filter
    if (statusFilter === 'draft') {
      result = result.filter(r => !r.formalizado_empleado_id);
    } else if (statusFilter === 'formalized') {
      result = result.filter(r => !!r.formalizado_empleado_id);
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        (r.obrero_nombre ?? '').toLowerCase().includes(q) ||
        (r.obrero_cedula ?? '').includes(q) ||
        getNombreProyecto(r).toLowerCase().includes(q)
      );
    }

    // Sorting
    if (sortConfig.direction) {
      result.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (sortConfig.key === 'proyecto') {
          valA = getNombreProyecto(a);
          valB = getNombreProyecto(b);
        } else {
          valA = a[sortConfig.key as keyof Row] ?? '';
          valB = b[sortConfig.key as keyof Row] ?? '';
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rows, searchQuery, statusFilter, sortConfig]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedRows.length && filteredAndSortedRows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedRows.map(r => r.id)));
    }
  };

  async function performDelete(id: string, nombre: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/talento/contratos-express/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Error al eliminar');
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds(prev => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      toast.success(`Registro de ${nombre} eliminado exitosamente`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error en la operación de borrado');
    } finally {
      setBusyId(null);
      setDeleteConfirm(null);
    }
  }

  async function eliminarMasivo() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    
    setDeletingBulk(true);
    toast.info(`Iniciando eliminación de ${ids.length} registros...`);
    
    try {
      // Parallel deletion for better performance
      const results = await Promise.all(
        ids.map(id => fetch(`/api/talento/contratos-express/${id}`, { method: 'DELETE' }))
      );
      
      const successCount = results.filter(r => r.ok).length;
      
      setRows(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      
      if (successCount === ids.length) {
        toast.success(`Operación masiva completada: ${successCount} registros eliminados`);
      } else {
        toast.warning(`Completado con advertencias: ${successCount}/${ids.length} eliminados`);
      }
    } catch {
      toast.error('Fallo en la operación masiva de red');
    } finally {
      setDeletingBulk(false);
      void load();
    }
  }

  async function abrirPdfGenerado(id: string) {
    try {
      const res = await fetch(`/api/talento/contratos-express/${id}/pdf-url`);
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) {
        toast.error(j.error ?? 'PDF no localizado en el servidor');
        return;
      }
      window.open(j.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Error al recuperar el documento digital');
    }
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Stats Board - Premium Glass Design */}
      <AnimatePresence mode="wait">
        {!loading && !err && rows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, staggerChildren: 0.08 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {[
              { label: 'Total', value: rows.length, max: rows.length, icon: FileText, color: 'zinc', accent: 'bg-white/10' },
              { label: 'Formalizados', value: rows.filter(r => !!r.formalizado_empleado_id).length, max: rows.length, icon: CheckSquare, color: 'emerald', accent: 'bg-emerald-500' },
              { label: 'Borradores', value: rows.filter(r => !r.formalizado_empleado_id).length, max: rows.length, icon: RefreshCw, color: 'amber', accent: 'bg-amber-500' },
              { label: 'Hoy', value: rows.filter(r => new Date(r.created_at).toDateString() === new Date().toDateString()).length, max: rows.length, icon: Calendar, color: 'sky', accent: 'bg-sky-500' },
            ].map((stat, i) => {
              const pct = stat.max > 0 ? Math.round((stat.value / stat.max) * 100) : 0;
              const textColor = stat.color === 'emerald' ? 'text-emerald-400' : stat.color === 'amber' ? 'text-amber-400' : stat.color === 'sky' ? 'text-sky-400' : 'text-white';
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="relative group overflow-hidden bg-zinc-900/30 border border-white/5 p-5 rounded-[1.75rem] backdrop-blur-xl transition-all duration-300 hover:bg-zinc-900/50 hover:border-white/10 hover:shadow-xl"
                >
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-black">{stat.label}</p>
                    <stat.icon className={`size-3.5 ${textColor} opacity-30 group-hover:opacity-60 transition-opacity`} />
                  </div>
                  <h3 className={`text-3xl font-black tabular-nums ${textColor}`}>{stat.value}</h3>
                  {/* Progress bar */}
                  <div className="mt-4 h-[2px] rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.07 + 0.3, ease: 'easeOut' }}
                      className={`h-full rounded-full ${stat.accent} opacity-60`}
                    />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Control Bar */}
      <div className="flex flex-col xl:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
          {/* Status Tabs */}
          <Tabs 
            defaultValue="all" 
            className="w-full sm:w-auto"
            onValueChange={(v) => setStatusFilter(v as any)}
          >
            <TabsList className="bg-zinc-900/50 border border-white/5 p-1 rounded-2xl h-12">
              <TabsTrigger value="all" className="rounded-xl px-5 text-[10px] uppercase font-black tracking-widest data-[state=active]:bg-zinc-800 data-[state=active]:text-amber-400">Todos</TabsTrigger>
              <TabsTrigger value="draft" className="rounded-xl px-5 text-[10px] uppercase font-black tracking-widest data-[state=active]:bg-zinc-800 data-[state=active]:text-amber-400">Borradores</TabsTrigger>
              <TabsTrigger value="formalized" className="rounded-xl px-5 text-[10px] uppercase font-black tracking-widest data-[state=active]:bg-zinc-800 data-[state=active]:text-amber-400">Formalizados</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search Input */}
          <div className="relative w-full sm:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-zinc-600 group-focus-within:text-amber-500 transition-colors duration-200" />
            <Input
              placeholder="Buscar nombre, cédula o proyecto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-10 h-12 bg-zinc-900/30 border-white/5 focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/10 rounded-2xl text-sm placeholder:text-zinc-600 transition-all duration-200 backdrop-blur-xl"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                >
                  <X className="size-3" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          {/* Active search badge */}
          <AnimatePresence>
            {searchQuery && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-black uppercase tracking-widest whitespace-nowrap"
              >
                <Filter className="size-2.5" />
                {filteredAndSortedRows.length} resultado{filteredAndSortedRows.length !== 1 ? 's' : ''}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Button
            variant="ghost"
            onClick={() => void load()}
            disabled={loading}
            className="h-12 w-12 p-0 rounded-2xl bg-zinc-900/30 border border-white/5 hover:bg-white/5 text-zinc-500 hover:text-white transition-all backdrop-blur-xl"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </Button>

          {selectedIds.size > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <Button
                variant="destructive"
                onClick={() => void eliminarMasivo()}
                disabled={deletingBulk}
                className="h-12 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-2xl px-6 font-black text-[10px] uppercase tracking-[0.1em]"
              >
                <Trash2 className="size-4 mr-2" />
                Eliminar {selectedIds.size}
              </Button>
            </motion.div>
          )}
          
          <Link href="/talento/admin/contratos/fast-create">
            <Button className="h-12 bg-white text-black hover:bg-amber-400 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl px-8 shadow-2xl shadow-white/5 transition-all active:scale-95">
              <Plus className="size-4 mr-2 stroke-[3]" />
              Nuevo Contrato
            </Button>
          </Link>
        </div>
      </div>

      {/* Advanced Table Container */}
      <div className="rounded-[2.5rem] border border-white/5 bg-zinc-950/20 shadow-2xl overflow-hidden backdrop-blur-3xl relative min-h-[500px]">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-zinc-950/40 backdrop-blur-md z-30">
            <div className="relative">
              <div className="size-20 rounded-[2rem] bg-zinc-900 border border-white/10 flex items-center justify-center animate-pulse shadow-2xl">
                <RefreshCw className="size-8 text-amber-500 animate-spin" />
              </div>
              <div className="absolute -inset-4 border border-amber-500/20 rounded-[2.5rem] animate-[ping_3s_infinite]" />
            </div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] animate-pulse">Sincronizando Archivo Maestro</p>
          </div>
        ) : err ? (
          <div className="flex flex-col items-center justify-center py-32 text-center px-10">
            <div className="size-20 rounded-[2rem] bg-red-500/10 flex items-center justify-center border border-red-500/20 mb-8">
              <AlertCircle className="size-10 text-red-500" />
            </div>
            <h3 className="text-xl font-black text-white mb-2">Error de Enlace</h3>
            <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-10 leading-relaxed">{err}</p>
            <Button variant="outline" onClick={() => void load()} className="border-white/10 rounded-2xl px-12 h-12 hover:bg-white/5 transition-all font-black text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white">
              Intentar Reconexión
            </Button>
          </div>
        ) : filteredAndSortedRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 text-center px-10">
            {searchQuery || statusFilter !== 'all' ? (
              // Empty due to active filter
              <>
                <div className="size-24 rounded-[2.5rem] bg-amber-500/5 flex items-center justify-center border border-amber-500/10 mb-8">
                  <Filter className="size-10 text-amber-500/40" />
                </div>
                <h3 className="text-2xl font-black text-white mb-3">Sin Coincidencias</h3>
                <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-8 leading-relaxed">
                  Ningún contrato coincide con {searchQuery ? `"${searchQuery}"` : ''}{statusFilter !== 'all' ? ` en estado ${statusFilter === 'draft' ? 'borrador' : 'formalizado'}` : ''}.
                </p>
                <button
                  onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                  className="text-[10px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-colors border border-amber-500/20 rounded-2xl px-8 h-10 hover:bg-amber-500/5"
                >
                  Limpiar Filtros
                </button>
              </>
            ) : (
              // Truly empty
              <>
                <div className="size-24 rounded-[2.5rem] bg-zinc-900/50 flex items-center justify-center border border-white/5 mb-8 shadow-inner">
                  <FileText className="size-10 text-zinc-700" />
                </div>
                <h3 className="text-2xl font-black text-white mb-3">Archivo Vacío</h3>
                <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-12 leading-relaxed">
                  No hay contratos Fast-Track registrados aún.
                </p>
                <Link href="/talento/admin/contratos/fast-create">
                  <Button className="bg-white text-black hover:bg-amber-400 rounded-2xl px-12 h-14 font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl transition-all">
                    Crear Primer Contrato
                  </Button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-900/40 border-b border-white/5 backdrop-blur-2xl">
                <TableRow className="border-none hover:bg-transparent">
                  <TableHead className="w-[80px] pl-8 py-6">
                    <button 
                      onClick={toggleSelectAll} 
                      className="text-zinc-700 hover:text-amber-500 transition-all focus:outline-none"
                    >
                      {selectedIds.size === filteredAndSortedRows.length && filteredAndSortedRows.length > 0 
                        ? <CheckSquare className="size-6 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]" /> 
                        : <Square className="size-6" />
                      }
                    </button>
                  </TableHead>
                  
                  <TableHead
                    className={`text-[10px] font-black uppercase tracking-[0.25em] py-6 cursor-pointer group/th transition-colors ${sortConfig.key === 'obrero_nombre' ? 'text-amber-400' : 'text-zinc-500'}`}
                    onClick={() => handleSort('obrero_nombre')}
                  >
                    <div className="flex items-center gap-2 group-hover/th:text-white transition-colors">
                      Identidad
                      {sortConfig.key === 'obrero_nombre'
                        ? sortConfig.direction === 'asc' ? <ChevronUp className="size-3 text-amber-500" /> : <ChevronDown className="size-3 text-amber-500" />
                        : <ArrowUpDown className="size-3 opacity-0 group-hover/th:opacity-100 transition-opacity" />}
                    </div>
                  </TableHead>

                  <TableHead
                    className={`text-[10px] font-black uppercase tracking-[0.25em] py-6 cursor-pointer group/th transition-colors ${sortConfig.key === 'proyecto' ? 'text-amber-400' : 'text-zinc-500'}`}
                    onClick={() => handleSort('proyecto')}
                  >
                    <div className="flex items-center gap-2 group-hover/th:text-white transition-colors">
                      Proyecto
                      {sortConfig.key === 'proyecto'
                        ? sortConfig.direction === 'asc' ? <ChevronUp className="size-3 text-amber-500" /> : <ChevronDown className="size-3 text-amber-500" />
                        : <ArrowUpDown className="size-3 opacity-0 group-hover/th:opacity-100 transition-opacity" />}
                    </div>
                  </TableHead>

                  <TableHead className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.25em] py-6 text-center">Estado</TableHead>
                  
                  <TableHead
                    className={`text-[10px] font-black uppercase tracking-[0.25em] py-6 text-center cursor-pointer group/th transition-colors ${sortConfig.key === 'created_at' ? 'text-amber-400' : 'text-zinc-500'}`}
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center justify-center gap-2 group-hover/th:text-white transition-colors">
                      Fecha
                      {sortConfig.key === 'created_at'
                        ? sortConfig.direction === 'asc' ? <ChevronUp className="size-3 text-amber-500" /> : <ChevronDown className="size-3 text-amber-500" />
                        : <ArrowUpDown className="size-3 opacity-0 group-hover/th:opacity-100 transition-opacity" />}
                    </div>
                  </TableHead>

                  <TableHead className="text-right pr-8 py-6 text-[10px] text-zinc-500 font-black uppercase tracking-[0.25em]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {filteredAndSortedRows.map((r, idx) => {
                    const formal = Boolean(r.formalizado_empleado_id);
                    const isSelected = selectedIds.has(r.id);
                    const isBusy = busyId === r.id;
                    
                    return (
                      <motion.tr 
                        key={r.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: idx * 0.03 }}
                        className={`border-b border-white/[0.03] group transition-all duration-300 ${isSelected ? 'bg-amber-500/[0.03]' : 'hover:bg-white/[0.02]'}`}
                      >
                        <TableCell className="pl-8 py-6">
                          <button 
                            onClick={() => toggleSelect(r.id)} 
                            className={`transition-all transform active:scale-90 ${isSelected ? 'text-amber-500' : 'text-zinc-800 group-hover:text-zinc-600'}`}
                          >
                            {isSelected ? <CheckSquare className="size-6" /> : <Square className="size-6" />}
                          </button>
                        </TableCell>
                        
                        <TableCell className="py-6">
                          <div className="flex items-center gap-4">
                            <div className={`size-12 rounded-2xl flex items-center justify-center text-[11px] font-black transition-all duration-500 ${formal ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-zinc-900 text-zinc-500 border border-white/5'}`}>
                              {r.obrero_nombre.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-white text-[14px] leading-tight group-hover:text-amber-200 transition-colors tracking-tight">{r.obrero_nombre}</span>
                              <span className="text-[10px] text-zinc-600 font-mono tracking-widest">{r.obrero_cedula}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="py-6">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Building2 className="size-3.5 text-zinc-700 group-hover:text-amber-500/50 transition-colors" />
                              <span className="text-zinc-300 text-xs font-bold truncate max-w-[200px] tracking-tight">{getNombreProyecto(r)}</span>
                            </div>
                            <span className="text-[9px] text-zinc-600 font-mono ml-5 opacity-60">ID: {r.proyecto_id.slice(0, 13)}</span>
                          </div>
                        </TableCell>

                        <TableCell className="text-center py-6">
                          {formal ? (
                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] font-black uppercase tracking-[0.2em] py-1 px-3 rounded-full">
                              Formalizado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-zinc-900/50 border-white/5 text-zinc-600 text-[8px] font-black uppercase tracking-[0.2em] py-1 px-3 rounded-full">
                              Borrador
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-center py-6">
                          <div className="flex flex-col items-center">
                            <span className="text-[11px] font-mono text-zinc-400">
                              {new Date(r.created_at).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            </span>
                            <span className="text-[9px] text-zinc-700 font-mono">
                              {new Date(r.created_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="pr-8 py-6 text-right">
                          <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-10 w-10 p-0 text-zinc-500 hover:text-amber-400 hover:bg-amber-400/10 rounded-xl transition-all" 
                              onClick={() => void abrirPdfGenerado(r.id)}
                              title="Visualizar Documento"
                            >
                              <FileText className="size-4.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              disabled={isBusy}
                              className="h-10 w-10 p-0 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all" 
                              onClick={() => setDeleteConfirm({ id: r.id, nombre: r.obrero_nombre, formalizado: formal })}
                              title="Eliminar Registro"
                            >
                              {isBusy ? <RefreshCw className="size-4.5 animate-spin" /> : <Trash2 className="size-4.5" />}
                            </Button>
                            <Link href={`/talento/admin/contratos/fast-create?copy=${r.id}`}>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-10 w-10 p-0 text-zinc-500 hover:text-sky-400 hover:bg-sky-400/10 rounded-xl transition-all"
                                title="Duplicar como Plantilla"
                              >
                                <ExternalLink className="size-4.5" />
                              </Button>
                            </Link>
                          </div>
                          {/* Mobile Actions Indicator */}
                          <div className="group-hover:hidden text-zinc-800 transition-opacity">
                            <MoreHorizontal className="size-5 ml-auto opacity-40" />
                          </div>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {!loading && !err && filteredAndSortedRows.length > 0 && (
        <div className="flex items-center justify-between px-6 text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em]">
          <span className="flex items-center gap-2">
            <Download className="size-3" />
            Sincronizado con Nodo Central
          </span>
          <span className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Estado: Online
            </div>
            <div className="w-px h-3 bg-white/5" />
            Resultados: {filteredAndSortedRows.length}
          </span>
        </div>
      )}

      {/* Premium Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent className="bg-zinc-950 border-white/10 rounded-[3rem] p-10 max-w-md backdrop-blur-3xl">
          <DialogHeader>
            <div className="relative mx-auto mb-8">
              <div className="size-24 rounded-[2.5rem] bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-2xl">
                <Trash2 className="size-10 text-red-500" />
              </div>
              <div className="absolute -inset-2 border border-red-500/10 rounded-[3rem] animate-pulse" />
            </div>
            <DialogTitle className="text-3xl font-black text-white text-center tracking-tighter mb-4">Eliminación Permanente</DialogTitle>
            <DialogDescription className="text-center text-zinc-500 leading-relaxed text-sm">
              Está a punto de remover el registro maestro de <strong className="text-white">{deleteConfirm?.nombre}</strong>.
              {deleteConfirm?.formalizado && (
                <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                  <p className="text-[11px] text-amber-500 uppercase font-black tracking-widest text-center">
                    Advertencia: El contrato ya cuenta con una formalización asociada.
                  </p>
                </div>
              )}
              <span className="block mt-4 text-xs opacity-60">Esta acción no puede deshacerse y purgará todos los archivos binarios asociados en el almacenamiento en la nube.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-4 pt-8">
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirm(null)}
              className="flex-1 rounded-2xl border-white/5 bg-zinc-900 text-zinc-400 hover:text-white h-14 font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirm && performDelete(deleteConfirm.id, deleteConfirm.nombre)}
              className="flex-1 rounded-2xl bg-red-600 hover:bg-red-500 text-white h-14 font-black text-[10px] uppercase tracking-widest shadow-2xl shadow-red-600/20 transition-all active:scale-95"
            >
              Confirmar Borrado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
