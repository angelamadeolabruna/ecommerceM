-- 06. Columnas y tablas que el codigo del backend usa y el seed original
--     no creaba.   Sin esto el catalogo falla con
--     "column p.destacado does not exist" y el modulo de respaldos con
--     "relation respaldo_programacion does not exist".

-- El catalogo ordena los destacados de la portada, asi que productos
-- necesita el booleano destacado y el descuento en porcentaje.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS destacado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS porcentaje_iva NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS descuento NUMERIC(5,2) NOT NULL DEFAULT 0;

-- Los cuatro destacados de la portada: PIJ-001, POL-001, TMU-REM-001 y
-- ZAP-001, con el descuento que se ve en la tienda.
UPDATE productos SET destacado = TRUE, descuento = 15 WHERE codigo = 'PIJ-001';
UPDATE productos SET destacado = TRUE, descuento = 25 WHERE codigo = 'POL-001';
UPDATE productos SET destacado = TRUE, descuento = 20 WHERE codigo = 'TMU-REM-001';
UPDATE productos SET destacado = TRUE, descuento = 10 WHERE codigo = 'ZAP-001';

-- El modulo de respaldos (SRV_RespaldosService) consulta esta tabla para
-- saber cuando correr el pg_dump automatico.
CREATE TABLE IF NOT EXISTS respaldo_programacion (
  id_programacion   SERIAL PRIMARY KEY,
  activa            BOOLEAN NOT NULL DEFAULT FALSE,
  frecuencia_horas  INTEGER NOT NULL DEFAULT 24,
  hora_ejecucion    TIME NOT NULL DEFAULT '02:00:00',
  ultima_ejecucion  TIMESTAMP,
  proxima_ejecucion TIMESTAMP,
  creado_en         TIMESTAMP NOT NULL DEFAULT NOW(),
  actualizado_en    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- El seed original marca los productos como "Disponible", pero el
-- catalogo y el carrito los buscan con estado "activo" (LOWER(estado) =
-- 'activo'), por eso salia el catalogo vacio.
UPDATE productos SET estado = 'Activo' WHERE LOWER(estado) = 'disponible';

-- El catalogo de la tienda solo ofrece lo que esta disponible, con 16% de
-- IVA como en las boletas.
UPDATE productos SET porcentaje_iva = 16 WHERE LOWER(estado) = 'activo';
