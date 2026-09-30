-- =====================================================================
-- IMAGENES DE LOS PRODUCTOS DEL CATALOGO
-- =====================================================================
-- Este es el seed que hay que usar para las imagenes. Sustituye a
-- seed_imagenes_polera.sql, que solo sabia de poleras y que por eso dejaba
-- cinco de los siete productos del catalogo con la tarjeta en blanco.
--
-- Para que funciona, estas rutas tienen que coincidir con los ficheros que
-- estan en web/public/productos/. No se inventan: cada una es un SVG que
-- existe de verdad, y el nombre del fichero es el color en minuscula.
--
--   public/productos/remera/     blanco.svg  gris.svg  negro.svg
--   public/productos/polo/       azul.svg    rojo.svg
--   public/productos/campera/    gris.svg    negro.svg
--   public/productos/pantalon/   azul.svg    beige.svg
--   public/productos/vestido/    blanco.svg  rosa.svg
--   public/productos/pijama/     rosa.svg    verde.svg
--   public/productos/zapatilla/  blanco.svg  negro.svg
--
-- Que NO se vuelva a meter lo que habia antes, porque son los tres fallos
-- que arregla este seed:
--
--   1. Rutas a ficheros .png que no existen. La base de datos aceptaba la
--      ruta, el navegador no encontraba el fichero y la tarjeta salia vacia.
--   2. URLs de amazon.com y de careofcarl.com, que son fotos de otras
--      tiendas y solo cargaban con internet.
--   3. La imagen metida en base64 dentro de la propia fila, que hacia que
--      cada respuesta del catalogo pesara mas de un megabyte.
--
-- La columna id_color se rellena con el color real y no con null, porque
-- una imagen sin color no se puede elegir en la ficha y no se sabe a que
-- prenda pertenece. es_principal marca la que sale en la tarjeta antes de
-- que el cliente elija color.

-- id_color: 1 Negro, 2 Blanco, 3 Rojo, 4 Azul, 5 Verde, 6 Gris, 7 Beige, 8 Rosa

-- Evita duplicados si se ejecuta dos veces. Se borra lo anterior de estos
-- siete productos, que es lo unico que este fichero gestiona.
DELETE FROM producto_imagenes
WHERE id_producto IN (
  SELECT id_producto FROM productos
  WHERE codigo IN ('TMU-REM-001','POL-001','ABR-001','PAN-001','PIJ-001','VES-001','ZAP-001')
);

INSERT INTO producto_imagenes (id_producto, id_color, url, es_principal, orden)
SELECT p.id_producto, v.id_color, v.url, v.principal, v.orden
FROM (
  VALUES
    -- Remera basica de algodon
    ('TMU-REM-001', 1, '/productos/remera/negro.svg',  true,  1),
    ('TMU-REM-001', 2, '/productos/remera/blanco.svg', false, 2),
    ('TMU-REM-001', 6, '/productos/remera/gris.svg',   false, 3),

    -- Polo manga corta
    ('POL-001',     3, '/productos/polo/rojo.svg',    true,  1),
    ('POL-001',     4, '/productos/polo/azul.svg',    false, 2),

    -- Campera liviana
    ('ABR-001',     1, '/productos/campera/negro.svg', true,  1),
    ('ABR-001',     6, '/productos/campera/gris.svg',  false, 2),

    -- Pantalon chino slim
    ('PAN-001',     4, '/productos/pantalon/azul.svg',  true,  1),
    ('PAN-001',     7, '/productos/pantalon/beige.svg', false, 2),

    -- Pijama de algodon
    ('PIJ-001',     8, '/productos/pijama/rosa.svg',   true,  1),
    ('PIJ-001',     5, '/productos/pijama/verde.svg',  false, 2),

    -- Vestido casual de verano
    ('VES-001',     8, '/productos/vestido/rosa.svg',   true,  1),
    ('VES-001',     2, '/productos/vestido/blanco.svg', false, 2),

    -- Zapatillas urbanas
    ('ZAP-001',     1, '/productos/zapatilla/negro.svg',  true,  1),
    ('ZAP-001',     2, '/productos/zapatilla/blanco.svg', false, 2)
) AS v(codigo, id_color, url, principal, orden)
JOIN productos p ON p.codigo = v.codigo
JOIN colores   c ON c.id_color = v.id_color;

-- El id_imagen es SERIAL, asi que hay que dejar el contador por encima de
-- lo que se ha insertado, o el siguiente INSERT que venga fallara con
-- "duplicate key value violates unique constraint".
SELECT setval(
  pg_get_serial_sequence('producto_imagenes', 'id_imagen'),
  GREATEST((SELECT COALESCE(MAX(id_imagen), 1) FROM producto_imagenes), 1)
);

-- Comprobacion. Todas las filas deben apuntar a /productos/... y ninguna a
-- data: ni a http, que eran los dos fallos que se corrigieron.
SELECT p.codigo,
       c.nombre  AS color,
       i.url,
       i.es_principal
FROM producto_imagenes i
JOIN productos p ON p.id_producto = i.id_producto
LEFT JOIN colores c ON c.id_color = i.id_color
ORDER BY p.codigo, i.orden;
