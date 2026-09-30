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

  const r = await client.query(`
    SELECT ur.id_usuario, r.id_rol, r.nombre_rol, r.permisos_json
    FROM usuarios u
    JOIN usuarios_roles ur ON u.id_usuario = ur.id_usuario
    JOIN roles r ON ur.id_rol = r.id_rol
    WHERE u.email LIKE '%cu36@tiendasmontano.com'
  `);
  console.log('Roles cajero:', JSON.stringify(r.rows, null, 2));

  const r2 = await client.query(`
    SELECT ur.id_usuario, r.id_rol, r.nombre_rol, r.permisos_json
    FROM usuarios u
    JOIN usuarios_roles ur ON u.id_usuario = ur.id_usuario
    JOIN roles r ON ur.id_rol = r.id_rol
    WHERE u.email LIKE '%cu32@tiendasmontano.com'
  `);
  console.log('Roles encargado:', JSON.stringify(r2.rows, null, 2));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
