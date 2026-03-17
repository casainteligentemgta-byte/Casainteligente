import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as Papa from 'papaparse';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'TU_URL_SUPABASE';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'TU_SERVICE_ROLE_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

const normalizarTexto = (texto: string): string => {
  if (!texto) return 'Sin Definir';
  return texto
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
};

const normalizarSKU = (sku: string): string => {
  if (!sku) return `SKU-GENERIC-${Math.floor(Math.random() * 10000)}`;
  return sku.trim().replace(/\s+/g, '-').toUpperCase(); 
};

const normalizarMoneda = (valor: string | number): number => {
  if (!valor) return 0.00;
  if (typeof valor === 'number') return valor;
  const numV = valor.toString().replace(/[^0-9.-]+/g, '');
  return parseFloat(numV) || 0.00;
};

async function runMigration() {
  console.log("🚀 Iniciando migración de Master Data de Productos...");

  const fileContent = fs.readFileSync('./productos_sharepoint.csv', 'utf8');

  Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      const lineasSueltas = results.data as any[];
      
      console.log(`📦 Encontrados ${lineasSueltas.length} registros crudos. Limpiando data...`);

      const productosLimpios = lineasSueltas.map(row => ({
        categoria: normalizarTexto(row.Categoria || row.categoria),
        marca: normalizarTexto(row.Marca || row.marca),
        modelo_sku: normalizarSKU(row.SKU || row.modelo_sku),
        descripcion_comercial: row.Descripcion || row.descripcion_comercial 
                               ? (row.Descripcion || row.descripcion_comercial).trim().replace(/\s+/g, ' ') 
                               : 'Sin descripción comercial.',
        costo_usd: normalizarMoneda(row.Costo || row.costo_usd),
        precio_lista: normalizarMoneda(row.Precio || row.precio_lista),
        unidad_medida: normalizarTexto(row.Unidad || row.unidad_medida) || 'Pza'
      }));

      console.log(`⚡ Insertando en base de datos...`);
      
      const { data, error } = await supabase
        .from('tb_productos_base')
        .insert(productosLimpios)
        .select('id, modelo_sku');

      if (error) {
        console.error("❌ Fallo en la inserción. REVISAR DUPLICADOS DE SKU.");
        console.error(error.message);
      } else {
        console.log(`✅ ¡Éxito! Migrados ${(data || []).length} productos a la tabla maestra de Casa Inteligente.`);
      }
    }
  });
}

runMigration();
