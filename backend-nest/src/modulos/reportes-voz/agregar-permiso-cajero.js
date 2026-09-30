import { config } from 'dotenv';
import pg from 'pg';

// La conexion se lee del entorno. La clave NO se escribe en el codigo.
// Ejecuta con el .env del API cargado, o con DATABASE_URL en la variable.
config({ path: 'api/.env' });
config({ path: '.env' });

const URL_BD = process.env.DATABASE_URL;
if (!URL_BD) {
  console.error('Falta DATABASE_URL en el entorno. Carga api/.env antes de ejecutar.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();

  // Agregar 'consultar_reportes' al Cajero (id_rol=3)
  const r = await client.query(`
    UPDATE roles
    SET permisos_json = permisos_json::jsonb || '["consultar_reportes"]'::jsonb
    WHERE id_rol = 3
      AND permisos_json::text NOT LIKE '%consultar_reportes%'
    RETURNING id_rol, nombre_rol, permisos_json
  `);
  console.log('Agregar permiso Cajero:', JSON.stringify(r.rows, null, 2));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
