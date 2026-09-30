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
