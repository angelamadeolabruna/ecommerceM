import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env' });

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  const sql = `
CREATE TABLE IF NOT EXISTS reportes_generativos (
    id_reporte SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario),
    tipo VARCHAR(40) NOT NULL,
    parametros JSONB NOT NULL DEFAULT '{}',
    formato VARCHAR(10) NOT NULL,
    url_archivo TEXT NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reportes_generativos_id_usuario ON reportes_generativos(id_usuario);
CREATE INDEX IF NOT EXISTS idx_reportes_generativos_fecha ON reportes_generativos(fecha);
`;
  await client.query(sql);
  console.log('Migración ejecutada: reportes_generativos creada correctamente.');
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
