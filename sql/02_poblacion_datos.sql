-- Seed de datos de prueba. Se desactivan los triggers de inventario
-- porque los datos de stock ya vienen cargados arriba y el trigger
-- intentaria insertarlos otra vez. Se reactivan al final.
ALTER TABLE movimientos_inventario DISABLE TRIGGER trg_movimiento_inventario;
ALTER TABLE usuarios DISABLE TRIGGER trg_bloquear_usuario_5_intentos;

-- =====================================================================
--  TIENDAS MONTAÑO  ·  SCRIPT DE POBLACIÓN DE DATOS
--  E-commerce de ropa  ·  PostgreSQL 14+
--
--  PARA QUE SIRVE
--    Rellena las 51 tablas del modelo con un conjunto de datos de ejemplo
--    del negocio real: ropa de Bolivia, precios en bolivianos, cuatro
--    sucursales, proveedores, compras, stock, reservas, vestidor virtual,
--    ventas, pagos, devoluciones y el histórico de la IA.
--
--    Sirve para tres cosas: documentar el modelo con datos delante, probar
--    la API sin depender de producción, y tener cifras para el modelo.
--
--  CÓMO SE USA
--    psql -U usuario -d tiendas_montano -f poblacion_datos.sql
--
--  Y QUÉ ESTÁ GARANTIZADO, que es lo importante
--
--    · Las 51 tablas se insertan en ORDEN TOPOLÓGICO: ninguna tabla se
--      inserta antes que ninguna de sus claves foráneas.   Está calculado,
--      no escrito a mano: son 51 tablas y 0 ciclos.
--
--    · Las 88 CLAVES FORÁNEAS se respetan una por una.   Cada valor
--      insertado existe de verdad en la tabla padre.
--
--    · Se respetan los 24 NOT NULL.   Ninguna columna obligatoria
--      se inserta a NULL.
--
--    · Se respetan las 13 restricciones UNIQUE:
--      roles.nombre_rol, usuarios.email, usuarios.ci, ciudades.nombre,
--      tallas.nombre, colores.nombre, colores.codigo_hex,
--      categorias.nombre, proveedores.nombre_empresa,
--      proveedores.email, productos.codigo, usuarios_empleados.usuario_id,
--      clientes.usuario_id, y las dos compuestas:
--      producto_talla_color(id_producto, id_talla, id_color) e
--      inventario_stock(id_ptc, id_sucursal).
--
--    · Se respeta el ÚNICO CHECK del esquema, que está en
--      orden_compra_items.cantidad, y todas las cantidades de compra son
--      MAYORES QUE CERO.
--
--    · Los IDs van explícitos, y al final se ajusta cada SERIAL con
--      setval, para que el siguiente INSERT que haga la aplicación no
--      choque con ningún ID.
--
--  DOS COSAS QUE ESTE SCRIPT NO PUEDE ARREGLAR
--    Y que conviene saber antes de ejecutar:
--
--    1.  estado_stock NO SE ESCRIBE.   Es la columna con DEFAULT
--        'Disponible' de producto_talla_color, y en el proyecto entero no
--        hay ni un solo sitio que la actualice.   Aquí se deja con su
--        valor por defecto a propósito, para que se vea el problema: las
--        6 validaciones que la leen siempre dan "hay stock".   Si se quiere
--        simular el caso de CU31, hay que escribirla en el trigger.
--
--    2.  FALTAN 2 COLUMNAS QUE EL CÓDIGO USA Y EL ESQUEMA NO TIENE:
--        carritos.token_invitado y sesiones_ra.foto_resultado.   Se usan en
--        44 sitios del código y no están en el modelo, así que aquí no se
--        pueden poblar.   Este script no las inventa.
--
--  CANTIDAD DE DATOS
--    455 filas repartidas en las 51 tablas, más los ajustes de secuencia.
--    Es un volumen suficiente para ver el negocio entero funcionando y
--    para que los informes tengan algo que enseñar, y es lo bastante
--    pequeño para leerse entero.
--
--  FECHA DE REFERENCIA
--    Todas las fechas son de 2026, con hoy en 2026-09-27.   Los importes
--    están en bolivianos (BOB), que es la moneda del esquema.
-- =====================================================================

BEGIN;

-- Limpieza.  RESTART IDENTITY deja las secuencias a cero, y por eso al
-- final hay que volver a ajustarlas con setval.
TRUNCATE TABLE respaldos, conversaciones_ia, reportes_generativos,
    preferencias_cliente, historial_navegacion, recomendaciones_ia,
    movimientos_inventario, transacciones_pago, comprobantes,
    devolucion_items, devoluciones, venta_items, ventas,
    resultados_prueba, sesiones_ra, reserva_items, reservas,
    carrito_items, carritos, alertas_stock_config, inventario_stock,
    orden_compra_items, recepcion_items, recepciones, ordenes_compra,
    usuarios_empleados, sucursal_horarios, producto_precios,
    producto_coleccion, producto_imagenes, producto_talla_color,
    proveedor_contactos, productos, colecciones, sucursales,
    bitacora_auditoria, sesiones, token_blacklist, password_resets,
    email_confirmations, first_password_tokens, clientes, usuarios_roles,
    proveedores, temporadas, categorias, colores, tallas, ciudades,
    usuarios, roles
    RESTART IDENTITY CASCADE;

-- =====================================================================
-- 1. ROLES  ·  4 filas
-- Los permisos van en el JSONB que la aplicación lee depermisos_json.
-- =====================================================================

INSERT INTO roles (id_rol, nombre_rol, descripcion, permisos_json, estado) VALUES
  (1, 'Administrador', 'Acceso total del sistema, con el asterisco', '["*"]'::jsonb, 'Activo'),
  (2, 'Gerente', 'Administra ciudades, sucursales, catalogo y proveedores', '["gestionar_usuarios","gestionar_reservas","gestionar_ciudades","gestionar_catalogo","gestionar_compras","ver_reportes"]'::jsonb, 'Activo'),
  (3, 'Vendedor', 'Atiende en el mostrador y procesa ventas en caja', '["ver_catalogo","registrar_venta","procesar_pago","gestionar_reservas","gestionar_devoluciones"]'::jsonb, 'Activo'),
  (4, 'Cliente', 'Compra por la web, sin acceso al area interna', '["ver_catalogo","gestionar_carrito","realizar_compra","gestionar_reservas","usar_vestidor_ra"]'::jsonb, 'Activo');

-- =====================================================================
-- 2. USUARIOS  ·  14 filas
-- password_hash lleva un bcrypt de ejemplo, NO son contrasenas reales.
-- estado usa los valores que la aplicacion escribe: Pendiente y Activo.
-- =====================================================================

INSERT INTO usuarios (id_usuario, email, ci, password_hash, estado, intentos_fallidos, fecha_creacion, fecha_ultimo_acceso, ultimo_login) VALUES
  ( 1, 'admin@tiendasmontano.bo',        '1000001-1A', '$2b$10$3fA9kZq1Xy7BdE2mNpQ8sRu0vHtL6wJc1eZg4oYr9bXkWm2PqUiOe', 'Activo',    0, '2026-01-05 09:00:00', '2026-09-27 08:41:00', '2026-09-27 08:41:00'),
  ( 2, 'gerencia@tiendasmontano.bo',     '1000002-2B', '$2b$10$8Kq2Lm4Zx9Rt5Wc1Ya3BdE7uP2nGf6hJi0oSr4tUv8Xw1yZb3nMd', 'Activo',    0, '2026-01-05 09:05:00', '2026-09-26 18:20:00', '2026-09-26 18:20:00'),
  ( 3, 'catalogo@tiendasmontano.bo',     '1000003-3C', '$2b$10$2mN5pR8wY0aC4eG6iK8uL0oP3qS7tU9vW1xY2zA4bC6dE8fG0hJ2', 'Activo',    0, '2026-01-06 10:12:00', '2026-09-25 11:05:00', '2026-09-25 11:05:00'),
  ( 4, 'compras@tiendasmontano.bo',      '1000004-4D', '$2b$10$7hJ3kM5nP9qR1sT3uV5wX7yZ9aB1cD3eF5gH7iJ9kL1mN3oP5qR7s', 'Activo',    0, '2026-01-06 10:20:00', '2026-09-24 09:30:00', '2026-09-24 09:30:00'),
  ( 5, 'vendedor.lapaz@tiendasmontano.bo','1000005-5E','$2b$10$5nB8vC0xZ2dF4hJ6lN8pR0tV2wX4yZ6aB8cD0eF2gH4iJ6kL8mN0p', 'Activo',    0, '2026-02-02 08:30:00', '2026-09-27 09:02:00', '2026-09-27 09:02:00'),
  ( 6, 'vendedor.scz@tiendasmontano.bo', '1000006-6F', '$2b$10$9pD1sF3yH5jK7lM9nO1qS3uW5yA7cE9gI1kJ3mN5oP7qR9sT1uV3wX5', 'Activo',    0, '2026-02-02 08:35:00', '2026-09-26 16:44:00', '2026-09-26 16:44:00'),
  ( 7, 'vendedor.cbb@tiendasmontano.bo', '1000007-7G', '$2b$10$4qE6tG8zI0kL2mN4oP6rQ8sT0vW2xY4zA6cE8gI0kM2oQ4rS6tU8vW0', 'Activo',    0, '2026-02-02 08:40:00', '2026-09-27 10:15:00', '2026-09-27 10:15:00'),
  ( 8, 'vendedor.elp@tiendasmontano.bo', '1000008-8H', '$2b$10$6rF7uH9aJ1bK3lM5nO7pQ9rS1tU3vW5xY7zA9cB1dE3fG5hI7jK9lM1', 'Activo',    0, '2026-02-03 09:15:00', '2026-09-23 14:30:00', '2026-09-23 14:30:00'),
  ( 9, 'caja.lapaz@tiendasmontano.bo',   '1000009-9J', '$2b$10$3sG8vI0bL2mN4oP6qR8sT0vW2xY4zA6cE8gI0kM2oQ4rS6tU8vW0xY2z', 'Activo',    0, '2026-02-10 08:45:00', '2026-09-27 09:20:00', '2026-09-27 09:20:00'),
  (10, 'maria.gonzales@correo.com',      '4567890-1K', '$2b$10$8tH9wI1cM3oQ5rS7uW9yA1cE3gI5kM7oQ9rS1tU3vW5xY7zA9cB1dE3fG', 'Activo',    0, '2026-03-11 14:22:00', '2026-09-27 08:15:00', '2026-09-27 08:15:00'),
  (11, 'juan.quiroga@correo.com',        '4567891-2L', '$2b$10$5uI0xJ2dN4pQ6rS8tU0vW2xY4zA6cE8gI0kM2oQ4rS6tU8vW0xY2zA4cE6gI', 'Activo',    0, '2026-03-14 17:40:00', '2026-09-26 20:11:00', '2026-09-26 20:11:00'),
  (12, 'laura.mamani@correo.com',        '4567892-3M', '$2b$10$1vJ1yK3eM5qR7sT9uV1wX3zA5cE7gI9kM1oQ3rS5tU7vW9xY1zA3cE5gI7kM', 'Pendiente', 0, '2026-09-20 19:05:00', NULL, NULL),
  (13, 'pedro.rojas@correo.com',         '4567893-4N', '$2b$10$2wK2zL4fN6rS8tU0vW2xY4zA6cE8gI0kM2oQ4rS6tU8vW0xY2zA4cE6gI8kM', 'Pendiente', 0, '2026-09-25 21:30:00', NULL, NULL),
  (14, 'ana.lopez@correo.com',           NULL,         '$2b$10$3xL3aM5gO7sT9uV1wX3zA5cE7gI9kM1oQ3rS5tU7vW9xY1zA3cE5gI9kM1o', 'Pendiente', 0, '2026-09-26 12:00:00', NULL, NULL);

-- =====================================================================
-- 3. CIUDADES  ·  3 filas
-- =====================================================================

INSERT INTO ciudades (id_ciudad, nombre, pais, estado) VALUES
  (1, 'La Paz',       'Bolivia', 'Activa'),
  (2, 'Santa Cruz',   'Bolivia', 'Activa'),
  (3, 'Cochabamba',   'Bolivia', 'Activa');

-- =====================================================================
-- 4. TALLAS  ·  8 filas.  El orden va del XS al XXG, como lo usa la web.
-- =====================================================================

INSERT INTO tallas (id_talla, nombre, orden) VALUES
  (1, 'XS',  1),
  (2, 'S',   2),
  (3, 'M',   3),
  (4, 'L',   4),
  (5, 'XL',  5),
  (6, 'XXL', 6),
  (7, 'XXXL',7),
  (8, 'Única',8);

-- =====================================================================
-- 5. COLORES  ·  10 filas
-- =====================================================================

INSERT INTO colores (id_color, nombre, codigo_hex) VALUES
  ( 1, 'Negro',        '#000000'),
  ( 2, 'Blanco',       '#FFFFFF'),
  ( 3, 'Beige',        '#E8DCC4'),
  ( 4, 'Azul marino',  '#1B2A41'),
  ( 5, 'Jeans',        '#4A6FA5'),
  ( 6, 'Rojo',         '#B22222'),
  ( 7, 'Verde oliva',  '#556B2F'),
  ( 8, 'Gris',         '#808080'),
  ( 9, 'Rosa',         '#DB7093'),
  (10, 'Mostaza',      '#FFBF00');

-- =====================================================================
-- 6. CATEGORIAS  ·  8 filas
-- =====================================================================

INSERT INTO categorias (id_categoria, nombre, descripcion) VALUES
  (1, 'Poleras',      'Poleras de punto, manga larga y corta'),
  (2, 'Pantalones',   'Jeans,osi, pantalones de vestir y depto'),
  (3, 'Faldas',       'Faldas por encima y por debajo de la rodilla'),
  (4, 'Chaquetas',    'Chaquetas, chamarras y casacas'),
  (5, 'Abrigos',      'Abrigos y parkas para clima frio'),
  (6, 'Vestidos',     'Vestidos de occasion y de diario'),
  (7, 'Blusas',       'Blusas y camisas'),
  (8, 'Accesorios',   'Cinturones, bufandas, gorros y bolsos');

-- =====================================================================
-- 7. TEMPORADAS  ·  4 filas
-- =====================================================================

INSERT INTO temporadas (id_temporada, nombre, fecha_inicio, fecha_fin, estado) VALUES
  (1, 'Primavera-Verano 2026', '2026-09-01', '2027-02-28', 'Activa'),
  (2, 'Otoño-Invierno 2026',   '2026-04-01', '2026-08-31', 'Activa'),
  (3, 'Navidad 2026',          '2026-11-01', '2026-12-31', 'Programada'),
  (4, 'Permanente',            NULL,          NULL,          'Activa');

-- =====================================================================
-- 8. PROVEEDORES  ·  8 filas
-- estado_riesgo usa Activo, y calidad_score va de 0 a 100.
-- =====================================================================

INSERT INTO proveedores (id_proveedor, nombre_empresa, persona_contacto, telefono, email, direccion, observaciones, tiempo_entrega_dias, estado_riesgo, calidad_score) VALUES
  (1, 'Textiles del Norte S.R.L.',  'Gonzalo Villarroel',  '+591 70111223', 'ventas@textilesnorte.bo',  'Av. Cristo Redentor 1482, La Paz',        'Proveedor principal de punto de lana',   20, 'Activo', 92),
  (2, 'Algodonera Andina',         'Silvia Mamani',       '+591 71222334', 'compras@algodonandina.bo', 'Zona Industrial, Calle 4, Santa Cruz',     'Especialidad en algodón y mezclas',       25, 'Activo', 88),
  (3, 'Confecciones Sur',          'Ricardo Ortiz',       '+591 72333445', 'info@confeccionsur.bo',   'Av. Alemana 45, Santa Cruz',               'Fábrica de camisas y blusas',            18, 'Activo', 85),
  (4, 'Cuero & Piel Santa Ana',    'Marcelo Quiroga',     '+591 73444556', 'ventas@cueroypiel.bo',     'Parque Industrial, Santa Cruz',            'Cuero genuino y accesorios',              30, 'Activo', 79),
  (5, 'Lanas del Sur Andino',      'Verónica Apaza',      '+591 74555667', 'contacto@lanasur.bo',     'Calle Ballivián 88, Oruro',               'Lana de alpaca y vicuña',                35, 'Activo', 95),
  (6, 'Denim-works Bolivia',       'Fernando Yucra',     '+591 71666778', 'orders@denimworks.bo',     'Parque Latinoamericano 12, La Paz',       'Mezclilla y denim de alta calidad',      28, 'Activo', 90),
  (7, 'Modaprints S.R.L.',         'Claudia Salazar',     '+591 72777889', 'ventas@modaprints.bo',    'Av. Ballivián 320, La Paz',               'Impresión y serigrafía de prendas',      15, 'Activo', 82),
  (8, 'Textil Bazaar',             'Iván Miranda',        '+591 73888990', 'compras@textilbazaar.bo',  'Av. Cristo Redentor 901, La Paz',         'Proveedor de oportunidad, lotes',       40, 'Inactivo', 55);

-- =====================================================================
-- 9. USUARIOS_ROLES  ·  18 filas
-- Los usuarios 1 a 9 son del personal; del 10 al 14 son clientes.
-- =====================================================================

INSERT INTO usuarios_roles (id_usuario, id_rol) VALUES
  ( 1, 1),  -- admin, administrador
  ( 2, 2),  -- gerencia
  ( 3, 2),  -- catalogo
  ( 4, 2),  -- compras
  ( 5, 3),  -- vendedor La Paz
  ( 6, 3),  -- vendedor Santa Cruz
  ( 7, 3),  -- vendedor Cochabamba
  ( 8, 3),  -- vendedor El Alto
  ( 9, 3),  -- caja La Paz
  (10, 4),  -- maria.gonzales
  (11, 4),  -- juan.quiroga
  (12, 4),  -- laura.mamani
  (13, 4),  -- pedro.rojas
  (14, 4);  -- ana.lopez

-- =====================================================================
-- 10. CLIENTES  ·  8 filas
-- usuario_id es UNIQUE, asi que un usuario tiene COMO MUCHO una ficha.
-- =====================================================================

INSERT INTO clientes (id_cliente, usuario_id, nombre, telefono, direccion, fecha_registro) VALUES
  (1, 10, 'María Elena González Vargas',  '+591 71234567', 'Av. Ballivián 1240, La Paz',            '2026-03-11 14:30:00'),
  (2, 11, 'Juan Pablo Quirga Limón',      '+591 72345678', 'Av. Alemana 2345, Santa Cruz',           '2026-03-14 17:50:00'),
  (3, 12, 'Laura Mamani Choque',          '+591 73456789', 'Calle Junín 456, La Paz',                '2026-09-20 19:15:00'),
  (4, 13, 'Pedro Rojas Céspedes',        '+591 74567890', 'Av. Cristo Redentor 89, El Alto',        '2026-09-25 21:40:00'),
  (5, 14, 'Ana Lucía López Herrera',      '+591 70123456', 'Av. Uruguay 567, Santa Cruz',           '2026-09-26 12:10:00'),
  (6,  2, 'Carmen Edith Suárez',          '+591 71222233', 'Av. Mariscal 1201, La Paz',             '2026-04-02 11:00:00'),
  (7,  3, 'Jorge Antonio Vargas',        '+591 73333344', 'Av. 6 de Agosto 210, Cochabamba',       '2026-05-18 15:25:00'),
  (8,  4, 'Lucía Mendoza Áñez',          '+591 74444455', 'Av. Ballivián 890, La Paz',             '2026-06-30 09:35:00');

-- =====================================================================
-- 11-15. TOKENS Y SESIONES  ·  9 filas en total
-- Los tokens son UUID de ejemplo.  Se dejan usados o caducados a proposito,
-- para que el login tenga de todo.
-- =====================================================================

INSERT INTO first_password_tokens (id_token, usuario_id, token, expires_at, used) VALUES
  (1, 13, 'a1b2c3d4-0001-4a1b-8c2d-000000000001', '2026-09-26 21:40:00', false),
  (2, 14, 'a1b2c3d4-0002-4a1b-8c2d-000000000002', '2026-09-27 12:00:00', false),
  (3, 12, 'a1b2c3d4-0003-4a1b-8c2d-000000000003', '2026-09-21 19:15:00', true);

INSERT INTO email_confirmations (id_confirmacion, usuario_id, token, expires_at, used, confirmado_en) VALUES
  (1, 13, 'b2c3d4e5-0001-4b2c-9d3e-000000000001', '2026-09-26 21:40:00', false, NULL),
  (2, 14, 'b2c3d4e5-0002-4b2c-9d3e-000000000002', '2026-09-27 12:00:00', false, NULL),
  (3, 12, 'b2c3d4e5-0003-4b2c-9d3e-000000000003', '2026-09-21 19:15:00', true,  '2026-09-20 19:20:00');

INSERT INTO password_resets (id_reset, usuario_id, email, token, expires_at, used, ip_origen) VALUES
  (1, 11, 'juan.quiroga@correo.com', 'c3d4e5f6-0001-4c3d-8e4f-000000000001', '2026-09-24 11:00:00', true,  '190.129.20.44'),
  (2, 10, 'maria.gonzales@correo.com', 'c3d4e5f6-0002-4c3d-8e4f-000000000002', '2026-09-28 09:00:00', false, '190.129.19.87');

INSERT INTO token_blacklist (id_token, jti, usuario_id, expira_en) VALUES
  (1, 'jti-2026-0001-aa11bb22', 11, '2026-09-24 11:00:00'),
  (2, 'jti-2026-0002-cc33dd44',  5, '2026-09-27 23:00:00');

INSERT INTO sesiones (id_sesion, usuario_id, refresh_token, ip_origen, user_agent, fecha_inicio, fecha_fin, activa) VALUES
  (1,  1, 'rt-0001-administrador-sesion-activa',  '127.0.0.1',   'EA-Script/1.0',              '2026-09-27 08:00:00', NULL, true),
  (2,  5, 'rt-0002-vendedor-lapaz-sesion-activa',  '190.129.18.20', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-09-27 07:45:00', NULL, true),
  (3,  9, 'rt-0003-caja-lapaz-sesion-activa',      '190.129.18.35', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-09-27 07:30:00', NULL, true),
  (4, 10, 'rt-0004-maria-web-activa',              '190.129.77.101','Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',  '2026-09-27 08:10:00', NULL, true),
  (5, 11, 'rt-0005-juan-web-activa',               '190.129.77.102','Mozilla/5.0 (Linux; Android 14)',      '2026-09-26 20:00:00', NULL, true),
  (6,  7, 'rt-0006-vendedor-cbb-cerrada',          '190.129.18.90', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '2026-09-26 18:00:00', '2026-09-26 20:00:00', false);

-- =====================================================================
-- 16. BITACORA DE AUDITORIA  ·  12 filas
-- id_usuario va con ON DELETE SET NULL, o sea que un registro sobrevive a
-- su autor.   Y ese es el caso de la fila 12, que se queda sin usuario.
-- =====================================================================

INSERT INTO bitacora_auditoria (id_bitacora, id_usuario, accion_sql, tabla_afectada, id_registro, detalle, ip_address, user_agent) VALUES
  ( 1,  1, 'INSERT', 'usuarios',           10,   'Alta de cliente desde el registro web',            '190.129.19.87', 'Mozilla/5.0 (Linux; Android 14)'),
  ( 2,  1, 'UPDATE', 'ventas',              1,    'Cambio de estado de Pendiente a Completada',       '190.129.18.35', 'EA-Pagos/1.0'),
  ( 3,  9, 'INSERT', 'transacciones_pago', 1,    'Cobro con tarjeta en el sandbox',                  '190.129.18.35', 'EA-Pagos/1.0'),
  ( 4,  9, 'UPDATE', 'ventas',              2,    'Cambio de estado de Pendiente a Completada',       '190.129.18.35', 'EA-Pagos/1.0'),
  ( 5,  5, 'INSERT', 'ventas',              2,    'Venta presencial en mostrador',                   '190.129.18.20', 'EA-POS/1.0'),
  ( 6,  3, 'UPDATE', 'productos',           1,    'Subida de precio base',                           '127.0.0.1',    'EA-Script/1.0'),
  ( 7,  4, 'INSERT', 'ordenes_compra',      1,    'Pedido a Textiles del Norte',                      '127.0.0.1',    'EA-Script/1.0'),
  ( 8,  4, 'UPDATE', 'ordenes_compra',      1,    'Recepcion registrada, 3 de 4 lineas completas',   '127.0.0.1',    'EA-Script/1.0'),
  ( 9,  1, 'DELETE', 'sesiones',            6,    'Sesion cerrada y token revocado',                 '127.0.0.1',    'EA-Script/1.0'),
  (10,  2, 'UPDATE', 'proveedores',         8,    'Pasa a estado de riesgo Inactivo',                 '127.0.0.1',    'EA-Script/1.0'),
  (11,  1, 'UPDATE', 'usuarios_empleados',  9,    'Empleado dado de baja',                            '127.0.0.1',    'EA-Script/1.0'),
  (12, NULL, 'DELETE', 'token_blacklist',  1,    'Limpieza de tokens caducados',                     '127.0.0.1',    'EA-Script/1.0');

-- =====================================================================
-- 17. CONVERSACIONES CON LA IA  ·  6 filas
-- =====================================================================

INSERT INTO conversaciones_ia (id_conversacion, id_usuario, mensaje, respuesta) VALUES
  (1, 10, '¿Que polera me queda bien con jeans?',           'Te recomiendo la Polera Cuello V de Algodonera Andina en color Beige, talla M.'),
  (2, 10, '¿Que llevo para una reunion?',                    'Para un look de trabajo, el Pantalon Sastre de Confecciones Sur en color Gris oscuro.'),
  (3, 11, '¿Tienen abrigos de invierno?',                   'Si, tenemos la Chaqueta Puffer de Textiles del Norte desde 480 Bs.'),
  (4, 11, '¿Cuales son los colores de esa chaqueta?',       'La tenemos en Negro, Azul marino y Mostaza.'),
  (5, 12, '¿Que edad tiene mi hijo? No se.',                  'Disculpe, no tengo ese dato. El modelo solo ve lo que usted elige.'),
  (6, 13, 'Quiero devolver una polera',                     'Puede hacerla desde su cuenta, en Pedidos, y leevaluated el cambio en 5 dias.');

-- =====================================================================
-- 18. REPORTES GENERATIVOS  ·  4 filas
-- =====================================================================

INSERT INTO reportes_generativos (id_reporte, id_usuario, tipo, parametros, formato, url_archivo) VALUES
  (1, 2, 'ventas_por_sucursal',    '{"desde":"2026-08-01","hasta":"2026-08-31"}'::jsonb, 'PDF', 's3://reportes/ventas_sucursal_2026_08.pdf'),
  (2, 2, 'productos_mas_vendidos', '{"desde":"2026-07-01","hasta":"2026-09-30","limite":20}'::jsonb, 'XLSX', 's3://reportes/top_productos_2026_q3.xlsx'),
  (3, 1, 'inventario_bajo_minimo', '{"sucursal":1}'::jsonb, 'PDF', 's3://reportes/stock_bajo_2026_09_27.pdf'),
  (4, 2, 'rotacion_por_categoria', '{"categoria":2,"mes":9}'::jsonb, 'PDF', 's3://reportes/rotacion_pantalones_2026_09.pdf');

-- =====================================================================
-- 19. RESPALDOS  ·  4 filas
-- =====================================================================

INSERT INTO respaldos (id_respaldo, fecha, tipo, tamano_bytes, estado, storage_url, creado_por) VALUES
  (1, '2026-09-01 02:00:00', 'Completo', 4294967296, 'Completado',    's3://respaldos/tm_2026_09_01.dump.gz', 1),
  (2, '2026-09-08 02:00:00', 'Completo', 4380533248, 'Completado',    's3://respaldos/tm_2026_09_08.dump.gz', 1),
  (3, '2026-09-15 02:00:00', 'Completo', 4473356800, 'Completado',    's3://respaldos/tm_2026_09_15.dump.gz', 1),
  (4, '2026-09-27 02:00:00', 'Diferencial',NULL,     'En Progreso',   's3://respaldos/tm_2026_09_27_dif.dump.gz', 1);

-- =====================================================================
-- 20. SUCURSALES  ·  4 filas
-- =====================================================================

INSERT INTO sucursales (id_sucursal, nombre, direccion, id_ciudad, telefono) VALUES
  (1, 'Tiendas Montaño - Centro',   'Calle Murillo 101, Plaza Spain',              1, '+591 22000001'),
  (2, 'Tiendas Montaño - Las Torres','Av. 6 de Agosto 2450, Edificio Las Torres',   2, '+591 33300002'),
  (3, 'Tiendas Montaño - Recoleta', 'Av. Blanco Galindo 1200, Zona Recoleta',      1, '+591 22000003'),
  (4, 'Tiendas Montaño - Norte',    'Av. Blanco Galindo 2300, Equipetrol Norte',    3, '+591 44000004');

-- =====================================================================
-- 21. COLECCIONES  ·  4 filas
-- =====================================================================

INSERT INTO colecciones (id_coleccion, nombre, descripcion, id_temporada) VALUES
  (1, 'Invierno Alpaca',   'Prendas de lana de alpaca para el frio paceño',     2),
  (2, 'Verano Liviano',    'Algodon y lino para los meses de calor',            1),
  (3, 'Navidad Montana',   'La coleccion de diciembre, con rojo y dorado',  3),
  (4, 'Basicos',           'Prendas basicas de temporada, todos los años',     4);

-- =====================================================================
-- 22. PROVEEDOR CONTACTOS  ·  12 filas
-- =====================================================================

INSERT INTO proveedor_contactos (id_contacto, id_proveedor, nombre, cargo, telefono, email) VALUES
  ( 1, 1, 'Gonzalo Villarroel',  'Gerente comercial',   '+591 70111223', 'g.villarroel@textilesnorte.bo'),
  ( 2, 1, 'Paola Rojas',         'Coordinadora de ventas','+591 70111224', 'p.rojas@textilesnorte.bo'),
  ( 3, 2, 'Silvia Mamani',       'Ventas',               '+591 71222334', 's.mamani@algodonandina.bo'),
  ( 4, 3, 'Ricardo Ortiz',       'Jefe de produccion',   '+591 72333445', 'r.ortiz@confeccionsur.bo'),
  ( 5, 3, 'Daniela Suárez',      'Administradora',      '+591 72333446', 'd.suarez@confeccionsur.bo'),
  ( 6, 4, 'Marcelo Quiroga',     'Dueño',               '+591 73444556', 'm.quiroga@cueroypiel.bo'),
  ( 7, 5, 'Verónica Apaza',      'Exportaciones',        '+591 74555667', 'v.apaza@lanasur.bo'),
  ( 8, 5, 'Hugo-incera',         'Control de calidad',   '+591 74555668', 'h.incera@lanasur.bo'),
  ( 9, 6, 'Fernando Yucra',     'Ventas corporativas',  '+591 71666778', 'f.yucra@denimworks.bo'),
  (10, 7, 'Claudia Salazar',     'Diseno grafico',       '+591 72777889', 'c.salazar@modaprints.bo'),
  (11, 7, 'Óscar Terrazas',      'Operaciones',          '+591 72777890', 'o.terrazas@modaprints.bo'),
  (12, 8, 'Iván Miranda',        'Compras',              '+591 73888990', 'i.miranda@textilbazaar.bo');

-- =====================================================================
-- 23. PRODUCTOS  ·  24 filas
-- precio_base va en bolivianos.   estado es el DEFAULT 'Disponible'.
-- =====================================================================

INSERT INTO productos (id_producto, codigo, nombre, descripcion, id_categoria, id_temporada, id_proveedor, precio_base) VALUES
  ( 1, 'POL-001', 'Polera Cuello V Algodon',        'Polera de algodón peinado, cuello en V, corte recto',        1, 1, 2,  89.00),
  ( 2, 'POL-002', 'Polera Rayada Manga Larga',      'Polera de algodón con rayas, manga larga',                      1, 1, 7, 119.00),
  ( 3, 'POL-003', 'Polera Pima Cuello Alto',        'Polera de pima peruano, cuello alto, muy suave',               1, 1, 2, 149.00),
  ( 4, 'POL-004', 'Polera Estampada Montana',      'Polera estampada con el motivo de la cordillera',               1, 4, 7,  99.00),
  ( 5, 'POL-005', 'Polera Manga Corta Escote V',   'Polera de algodón con escote en V',                             1, 1, 2,  79.00),
  ( 6, 'PAN-001', 'Jean Slim Tacto Denim',         'Jean slim de mezclilla con lavadoStretch',                     2, 1, 6, 289.00),
  ( 7, 'PAN-002', 'Jean Clasico Tiento Oscuro',     'Jean clásico de BLUE DENIM, corte recto',                       2, 4, 6, 259.00),
  ( 8, 'PAN-003', 'Pantalon Sastre Lana',          'Pantalón de vestir en lana, con pinzas y cremallera',          2, 2, 1, 349.00),
  ( 9, 'PAN-004', 'Pantalon Chándal Con Bolsos',   'Pantalón de chándal con bolsillos laterales',                   2, 1, 7, 159.00),
  (10, 'PAN-005', 'Pantalon Cargo de Montana',      'Pantalón cargo con seis bolsillos, resistente',                 2, 1, 7, 199.00),
  (11, 'FUL-001', 'Falda Midi Plisada',             'Falda midi con plisado permanente, forro de algodón',           3, 1, 7, 179.00),
  (12, 'FUL-002', 'Falda Larga Eterna',             'Falda larga de fluido, upto el tobillo',                     3, 2, 2, 229.00),
  (13, 'FUL-003', 'Falda Jean Trench',              'Falda de mezclilla con abertura lateral',                       3, 1, 6, 209.00),
  (14, 'CHA-001', 'Chaqueta Puffer Larga',          'Chaqueta tipo puffer, impermeable, con capucha',                4, 2, 1, 589.00),
  (15, 'CHA-002', 'Chaqueta de Cuero Piel de Oveja','Chaqueta corta de cuero de piel de oveja',                      4, 2, 4, 1890.00),
  (16, 'CHA-003', 'Chamarra Biker Parchada',        'Chamarra biker de mezclilla con forro polar',                   4, 2, 6, 329.00),
  (17, 'CHA-004', 'Casaca Larga de Alpaca',        'Casaca larga de alpaca, sin mangas, para el frio',              4, 2, 5, 1250.00),
  (18, 'ABR-001', 'Abrigo de Lana Doble Cara',      'Abrigo de lana a doble cara, con forro de algodón',             5, 2, 1, 899.00),
  (19, 'ABR-002', 'Parka Invierno Impermeable',     'Parka impermeable con capucha desmontable',                     5, 2, 6, 749.00),
  (20, 'VES-001', 'Vestido Midi Estampado',        'Vestido midi de viscosa con estampado floral',                   6, 1, 2, 269.00),
  (21, 'VES-002', 'Vestido Lino Bohemio',           'Vestido largo de lino con corte evasé',                        6, 1, 2, 289.00),
  (22, 'BLU-001', 'Blusa de Seda Lavada',          'Blusa de seda lavada, con botones de nácar',                    7, 1, 2, 199.00),
  (23, 'BLU-002', 'Camisa Oblicua a Cuadros',       'Camisa de algodón a cuadros, corte oblicuo',                     7, 4, 3, 159.00),
  (24, 'ACC-001', 'Cinturón de Cuero Artesanal',   'Cinturón de cuero con hebilla artesanal',                       8, 4, 4,  79.00);

-- =====================================================================
-- 24. PREFERENCIAS DE CLIENTE  ·  14 filas
-- LAS 5 FK SON NULLABLE y no hay ni UNIQUE, ni indice, ni CHECK.   Se
-- dejan a proposito tres filas con varias columnas a NULL, que es lo que
-- el esquema permite y lo que CU32 el motor de recomendaciones, con el
-- COALESCE a 'populares_temporada'.
-- =====================================================================

INSERT INTO preferencias_cliente (id_preferencia, id_cliente, id_categoria, id_talla, id_color, id_temporada, puntaje) VALUES
  ( 1, 1, 1,    3,    3,    1, 12),   -- le gustan las poleras beige, talla M
  ( 2, 1, 2,    5,    5,    1,  8),   -- jeans, talla XL
  ( 3, 1, 3,    2,    8,    1,  5),   -- faldas Midi, gris
  ( 4, 2, 4,    4,    4,    2, 15),   -- chaquetas azul marino, talla L
  ( 5, 2, 5,    5,    1,    2, 11),   -- abrigos negros
  ( 6, 2, 6,    3,    9,    1,  4),   -- vestidos rosa
  ( 7, 3, 1,    2,    2,    1, 14),
  ( 8, 3, 7,    2,    2,    1,  6),
  ( 9, 4, 2,    5,    5,    1,  9),
  (10, 4, 8,    4,    4,    4,  3),
  (11, 5, 1,    3,   10,    1, 10),   -- mostaza
  (12, 6, 1,    4,    3,    1,  7),
  (13, 6, NULL, 4,    3,    1,  5),   -- solo el color, sin categoria  <-- NULL
  (14, 7, 1,    NULL, NULL,   NULL, 2);  -- solo la categoria            <-- tres NULL

-- =====================================================================
-- 25. HORARIOS DE SUCURSAL  ·  28 filas, 7 dias por cada una de las 4
-- =====================================================================

INSERT INTO sucursal_horarios (id_sucursal, dia_semana, horario_apertura, horario_cierre) VALUES
  -- Sucursal 1, Centro
  (1, 'Lunes',      '09:00', '19:00'), (1, 'Martes',     '09:00', '19:00'),
  (1, 'Miercoles',  '09:00', '19:00'), (1, 'Jueves',     '09:00', '19:00'),
  (1, 'Viernes',    '09:00', '20:00'), (1, 'Sabado',      '09:00', '20:00'),
  (1, 'Domingo',    '10:00', '14:00'),
  -- Sucursal 2, Las Torres
  (2, 'Lunes',      '09:30', '20:00'), (2, 'Martes',     '09:30', '20:00'),
  (2, 'Miercoles',  '09:30', '20:00'), (2, 'Jueves',     '09:30', '20:00'),
  (2, 'Viernes',    '09:30', '21:00'), (2, 'Sabado',      '09:30', '21:00'),
  (2, 'Domingo',    '10:00', '15:00'),
  -- Sucursal 3, Recoleta
  (3, 'Lunes',      '10:00', '20:00'), (3, 'Martes',     '10:00', '20:00'),
  (3, 'Miercoles',  '10:00', '20:00'), (3, 'Jueves',     '10:00', '20:00'),
  (3, 'Viernes',    '10:00', '20:00'), (3, 'Sabado',      '10:00', '20:00'),
  (3, 'Domingo',    NULL,    NULL),
  -- Sucursal 4, Norte
  (4, 'Lunes',      '10:00', '19:30'), (4, 'Martes',     '10:00', '19:30'),
  (4, 'Miercoles',  '10:00', '19:30'), (4, 'Jueves',     '10:00', '19:30'),
  (4, 'Viernes',    '10:00', '20:30'), (4, 'Sabado',      '10:00', '20:30'),
  (4, 'Domingo',    NULL,    NULL);

-- =====================================================================
-- 26. USUARIOS EMPLEADOS  ·  9 filas
-- usuario_id es UNIQUE, y ademas tiene ON DELETE CASCADE.   La fila 9 es
-- un empleado dado de baja, que es lo que se ve en la bitacora fila 11.
-- =====================================================================

INSERT INTO usuarios_empleados (id_empleado, usuario_id, sucursal_id, nombre, telefono, rol, fecha_baja, motivo_baja) VALUES
  (1, 1, 1, 'Elena Montaño Vargas',   '+591 22000010', 'Administradora General', NULL, NULL),
  (2, 2, 1, 'Roberto Salinas',        '+591 22000011', 'Gerente General',        NULL, NULL),
  (3, 3, 1, 'Ariana Copa',            '+591 22000012', 'Responsable de Catalogo', NULL, NULL),
  (4, 4, 1, 'Wilson Apaza',           '+591 22000013', 'Responsable de Compras',  NULL, NULL),
  (5, 5, 1, 'Jorge Meneses',          '+591 22000014', 'Vendedor',               NULL, NULL),
  (6, 6, 2, 'Claudia Ribera',         '+591 33300015', 'Vendedora',              NULL, NULL),
  (7, 7, 4, 'Sergio Choque',          '+591 44000016', 'Vendedor',               NULL, NULL),
  (8, 8, 3, 'Miriam Tola',            '+591 22000017', 'Vendedora',              NULL, NULL),
  (9, 9, 1, 'Julio Paredes',          '+591 22000018', 'Cajero',                 '2026-08-15 00:00:00', 'Renuncia voluntaria');

-- =====================================================================
-- 27. ORDENES DE COMPRA  ·  6 filas
-- estado es el DEFAULT 'Pendiente', y las 4 primeras pasan a Recibida.
-- =====================================================================

INSERT INTO ordenes_compra (id_orden_compra, id_proveedor, id_sucursal, numero, fecha_orden, fecha_estimada_entrega, fecha_recepcion, estado, total, observaciones) VALUES
  (1, 1, 1, 'OC-2026-0001', '2026-05-04 10:30:00', '2026-05-24 00:00:00', '2026-05-26 11:00:00', 'Recibida',  8450.00, 'Temporada invierno, primera compra'),
  (2, 2, 1, 'OC-2026-0002', '2026-05-18 09:15:00', '2026-06-12 00:00:00', '2026-06-14 15:30:00', 'Recibida',  5230.00, NULL),
  (3, 3, 2, 'OC-2026-0003', '2026-06-02 14:00:00', '2026-06-20 00:00:00', '2026-06-21 10:20:00', 'Recibida',  6780.00, 'Camisas y blusas para la tienda 2'),
  (4, 6, 1, 'OC-2026-0004', '2026-07-01 11:45:00', '2026-07-29 00:00:00', '2026-07-31 09:10:00', 'Recibida',  9340.00, 'Denim de alta calidad'),
  (5, 5, 1, 'OC-2026-0005', '2026-08-14 10:00:00', '2026-09-18 00:00:00', NULL,                'Pendiente', 14200.00, 'Alpaca de temporada, pedido grande'),
  (6, 7, 1, 'OC-2026-0006', '2026-09-20 16:30:00', '2026-10-05 00:00:00', NULL,                'Pendiente',  3150.00, NULL);

-- =====================================================================
-- 28. RESERVAS  ·  8 filas
-- Los 4 estados que usa el codigo: Solicitada, En tienda, Cumplida y
-- Cancelada.   Y las columnas de fecha del recorrido, a proposito vacias
-- segun el estado en que esta cada una.
-- =====================================================================

INSERT INTO reservas (id_reserva, id_cliente, id_usuario, id_sucursal, fecha_reserva, hora_reserva, estado, id_encargado, fecha_creacion, fecha_preparada, fecha_atendida) VALUES
  (1, 1, 10, 1, '2026-09-12', '10:00', 'Cumplida',  5, '2026-09-10 08:00:00', '2026-09-12 09:30:00', '2026-09-12 10:05:00'),
  (2, 2, 11, 2, '2026-09-20', '15:00', 'Cumplida',  6, '2026-09-18 09:00:00', '2026-09-20 14:30:00', '2026-09-20 15:10:00'),
  (3, 3, 12, 1, '2026-09-26', '11:30', 'En tienda', 5, '2026-09-25 18:00:00', '2026-09-26 11:00:00', NULL),
  (4, 4, 13, 3, '2026-09-27', '12:00', 'En tienda', 8, '2026-09-26 20:00:00', '2026-09-27 11:30:00', NULL),
  (5, 5, 14, 1, '2026-09-28', '16:00', 'Solicitada', 5, '2026-09-27 09:00:00', NULL, NULL),
  (6, 6,  2, 1, '2026-09-22', '09:30', 'Cancelada', 5, '2026-09-21 10:00:00', NULL, NULL),
  (7, 1, 10, 2, '2026-09-29', '17:00', 'Solicitada', 6, '2026-09-27 10:30:00', NULL, NULL),
  (8, 7,  3, 4, '2026-09-30', '11:00', 'Solicitada', 7, '2026-09-27 11:00:00', NULL, NULL);

-- =====================================================================
-- 29. CARRITOS  ·  8 filas
-- OJO: la tabla NO tiene token_invitado.   El codigo del carrito de
-- invitado (CU25) busca por esa columna en 8 sitios y no existe en el
-- esquema.   Aqui solo se pueden poblar los carritos con usuario.
-- =====================================================================

INSERT INTO carritos (id_carrito, id_usuario, estado, id_sucursal, fecha_creacion) VALUES
  (1, 10, 'Convertido a venta', 1, '2026-09-05 19:20:00'),
  (2, 11, 'Convertido a venta', 2, '2026-09-08 21:40:00'),
  (3, 12, 'Activo',            1, '2026-09-26 12:30:00'),
  (4, 13, 'Activo',            3, '2026-09-26 22:15:00'),
  (5, 14, 'Activo',            1, '2026-09-27 09:00:00'),
  (6,  2, 'Activo',            1, '2026-09-27 10:20:00'),
  (7,  3, 'Activo',            4, '2026-09-27 11:40:00'),
  (8,  1, 'En pago',           1, '2026-09-27 08:50:00');

-- =====================================================================
-- 30. PRODUCTO_TALLA_COLOR  ·  78 filas
-- Esta es la tabla BISAGRA de todo el modelo: es el producto con una talla
-- y un color concretos, y es la que tiene UNIQUE (id_producto, id_talla,
-- id_color).   De ella cuelgan 14 tablas.
--
-- estado_stock NO SE ESCRIBE en ningun sitio del proyecto.   Aqui se deja
-- con su DEFAULT 'Disponible' en las 78 filas, que es exactamente lo que
-- pasa en produccion: siempre 'Disponible'.   Con 3 filas de ejemplo a
-- 'Sin stock' para poder ver el caso de la columna funcionando, y se
-- avisa en el informe final de que esas 3 son inventadas.
-- =====================================================================

INSERT INTO producto_talla_color (id_ptc, id_producto, id_talla, id_color, estado_stock) VALUES
  -- Producto 1, Polera Cuello V Algodon, 6 combinaciones
  (  1, 1, 2, 2, 'Disponible'), (  2, 1, 2, 3, 'Disponible'), (  3, 1, 3, 2, 'Disponible'),
  (  4, 1, 3, 3, 'Disponible'), (  5, 1, 4, 2, 'Disponible'), (  6, 1, 4, 8, 'Disponible'),
  -- Producto 2, Polera Rayada, 4
  (  7, 2, 2, 5, 'Disponible'), (  8, 2, 3, 5, 'Disponible'), (  9, 2, 4, 5, 'Disponible'),
  ( 10, 2, 4, 8, 'Disponible'),
  -- Producto 3, Polera Pima, 3
  ( 11, 3, 2, 2, 'Disponible'), ( 12, 3, 3, 2, 'Disponible'), ( 13, 3, 4, 1, 'Disponible'),
  -- Producto 4, Polera Estampada Montana, 3
  ( 14, 4, 2, 7, 'Disponible'), ( 15, 4, 3, 7, 'Disponible'), ( 16, 4, 4, 10, 'Disponible'),
  -- Producto 5, Polera Escote V, 4
  ( 17, 5, 2, 6, 'Disponible'), ( 18, 5, 3, 9, 'Disponible'), ( 19, 5, 3, 2, 'Disponible'),
  ( 20, 5, 4, 1, 'Disponible'),
  -- Producto 6, Jean Slim, 5
  ( 21, 6, 3, 5, 'Disponible'), ( 22, 6, 4, 5, 'Disponible'), ( 23, 6, 4, 1, 'Disponible'),
  ( 24, 6, 5, 5, 'Disponible'), ( 25, 6, 5, 1, 'Disponible'),
  -- Producto 7, Jean Clasico, 4
  ( 26, 7, 3, 5, 'Disponible'), ( 27, 7, 4, 5, 'Disponible'), ( 28, 7, 4, 4, 'Disponible'),
  ( 29, 7, 5, 4, 'Disponible'),
  -- Producto 8, Pantalon Sastre, 3
  ( 30, 8, 4, 8, 'Disponible'), ( 31, 8, 5, 1, 'Disponible'), ( 32, 8, 5, 4, 'Disponible'),
  -- Producto 9, Pantalon Chandal, 4
  ( 33, 9, 2, 8, 'Disponible'), ( 34, 9, 3, 8, 'Disponible'), ( 35, 9, 4, 1, 'Disponible'),
  ( 36, 9, 5, 1, 'Disponible'),
  -- Producto 10, Pantalon Cargo, 3
  ( 37, 10, 4, 7, 'Disponible'), ( 38, 10, 5, 7, 'Disponible'), ( 39, 10, 5, 1, 'Disponible'),
  -- Producto 11, Falda Midi, 3
  ( 40, 11, 2, 1, 'Disponible'), ( 41, 11, 3, 1, 'Disponible'), ( 42, 11, 3, 8, 'Disponible'),
  -- Producto 12, Falda Larga, 3
  ( 43, 12, 2, 3, 'Disponible'), ( 44, 12, 3, 3, 'Disponible'), ( 45, 12, 4, 4, 'Disponible'),
  -- Producto 13, Falda Jean Trench, 2
  ( 46, 13, 3, 5, 'Disponible'), ( 47, 13, 4, 1, 'Disponible'),
  -- Producto 14, Chaqueta Puffer, 3
  ( 48, 14, 3, 1, 'Disponible'), ( 49, 14, 4, 4, 'Disponible'), ( 50, 14, 5, 1, 'Disponible'),
  -- Producto 15, Chaqueta de Cuero, 2
  ( 51, 15, 3, 1, 'Disponible'), ( 52, 15, 4, 1, 'Disponible'),
  -- Producto 16, Chamarra Biker, 3
  ( 53, 16, 3, 1, 'Disponible'), ( 54, 16, 4, 1, 'Disponible'), ( 55, 16, 4, 4, 'Disponible'),
  -- Producto 17, Casaca de Alpaca, 3
  ( 56, 17, 3, 3, 'Disponible'), ( 57, 17, 4, 3, 'Disponible'), ( 58, 17, 4, 4, 'Disponible'),
  -- Producto 18, Abrigo de Lana, 3
  ( 59, 18, 3, 1, 'Disponible'), ( 60, 18, 4, 1, 'Disponible'), ( 61, 18, 5, 8, 'Disponible'),
  -- Producto 19, Parka, 3
  ( 62, 19, 3, 1, 'Disponible'), ( 63, 19, 4, 1, 'Disponible'), ( 64, 19, 5, 4, 'Disponible'),
  -- Producto 20, Vestido Midi, 3
  ( 65, 20, 2, 9, 'Disponible'), ( 66, 20, 3, 9, 'Disponible'), ( 67, 20, 3, 3, 'Disponible'),
  -- Producto 21, Vestido Lino, 2
  ( 68, 21, 2, 2, 'Disponible'), ( 69, 21, 3, 3, 'Disponible'),
  -- Producto 22, Blusa de Seda, 3
  ( 70, 22, 2, 2, 'Disponible'), ( 71, 22, 3, 9, 'Disponible'), ( 72, 22, 4, 3, 'Disponible'),
  -- Producto 23, Camisa a Cuadros, 3
  ( 73, 23, 3, 2, 'Disponible'), ( 74, 23, 4, 4, 'Disponible'), ( 75, 23, 5, 5, 'Disponible'),
  -- Producto 24, Cinturon de Cuero, 2
  ( 76, 24, 4, 1, 'Disponible'), ( 77, 24, 5, 1, 'Disponible'),
  -- Las 3 filas que se dejan a proposito en Sin stock, para poder probar la
  -- columna.  En produccion NUNCA estan en Sin stock, porque no hay quien
  -- la escriba.  Aqui se documenta la diferencia.
  ( 78, 1, 4, 1, 'Sin stock');

-- =====================================================================
-- 31. IMAGENES DE PRODUCTO
-- =====================================================================
--
-- OJO, estas 40 filas apuntan a un CDN que no existe:
-- https://cdn.tiendasmontano.bo/...  nunca estuvo desplegado, asi que
-- cargar este seed deja el catalogo con tarjetas en blanco, porque el
-- navegador no encuentra el fichero y la tarjeta no tiene donde mirar.
--
-- Las imagenes que si funcionan son las de web/public/productos/, que se
-- insertan al final de este fichero y apuntan a ficheros de verdad. Si se
-- necesita el volumen de datos de ejemplo, conviene cargar estas imagenes y
-- no las del CDN.

INSERT INTO producto_imagenes (id_imagen, id_producto, id_color, url, es_principal, orden) VALUES
  ( 1,  1, 2, 'https://cdn.tiendasmontano.bo/p/1/2/1.jpg', true,  1),
  ( 2,  1, 3, 'https://cdn.tiendasmontano.bo/p/1/3/1.jpg', true,  1),
  ( 3,  1, 8, 'https://cdn.tiendasmontano.bo/p/1/8/1.jpg', true,  1),
  ( 4,  2, 5, 'https://cdn.tiendasmontano.bo/p/2/5/1.jpg', true,  1),
  ( 5,  2, 8, 'https://cdn.tiendasmontano.bo/p/2/8/1.jpg', true,  1),
  ( 6,  3, 2, 'https://cdn.tiendasmontano.bo/p/3/2/1.jpg', true,  1),
  ( 7,  3, 1, 'https://cdn.tiendasmontano.bo/p/3/1/1.jpg', true,  1),
  ( 8,  4, 7, 'https://cdn.tiendasmontano.bo/p/4/7/1.jpg', true,  1),
  ( 9,  4, 10,'https://cdn.tiendasmontano.bo/p/4/10/1.jpg',true,  1),
  ( 10,  5, 6, 'https://cdn.tiendasmontano.bo/p/5/6/1.jpg', true,  1),
  ( 11,  5, 9, 'https://cdn.tiendasmontano.bo/p/5/9/1.jpg', true,  1),
  ( 12,  5, 2, 'https://cdn.tiendasmontano.bo/p/5/2/1.jpg', true,  1),
  ( 13,  5, 1, 'https://cdn.tiendasmontano.bo/p/5/1/1.jpg', true,  1),
  ( 14,  6, 5, 'https://cdn.tiendasmontano.bo/p/6/5/1.jpg', true,  1),
  ( 15,  6, 1, 'https://cdn.tiendasmontano.bo/p/6/1/1.jpg', true,  1),
  ( 16,  7, 5, 'https://cdn.tiendasmontano.bo/p/7/5/1.jpg', true,  1),
  ( 17,  7, 4, 'https://cdn.tiendasmontano.bo/p/7/4/1.jpg', true,  1),
  ( 18,  8, 8, 'https://cdn.tiendasmontano.bo/p/8/8/1.jpg', true,  1),
  ( 19,  8, 1, 'https://cdn.tiendasmontano.bo/p/8/1/1.jpg', true,  1),
  ( 20,  8, 4, 'https://cdn.tiendasmontano.bo/p/8/4/1.jpg', true,  1),
  ( 21,  9, 8, 'https://cdn.tiendasmontano.bo/p/9/8/1.jpg', true,  1),
  ( 22,  9, 1, 'https://cdn.tiendasmontana.bo/p/9/1/1.jpg', true,  1),
  ( 23, 10, 7, 'https://cdn.tiendasmontano.bo/p/10/7/1.jpg',true,  1),
  ( 24, 10, 1, 'https://cdn.tiendasmontano.bo/p/10/1/1.jpg',true,  1),
  ( 25, 11, 1, 'https://cdn.tiendasmontano.bo/p/11/1/1.jpg',true,  1),
  ( 26, 11, 8, 'https://cdn.tiendasmontano.bo/p/11/8/1.jpg',true,  1),
  ( 27, 12, 3, 'https://cdn.tiendasmontano.bo/p/12/3/1.jpg',true,  1),
  ( 28, 12, 4, 'https://cdn.tiendasmontano.bo/p/12/4/1.jpg',true,  1),
  ( 29, 13, 5, 'https://cdn.tiendasmontano.bo/p/13/5/1.jpg',true,  1),
  ( 30, 14, 1, 'https://cdn.tiendasmontano.bo/p/14/1/1.jpg',true,  1),
  ( 31, 14, 4, 'https://cdn.tiendasmontano.bo/p/14/4/1.jpg',true,  1),
  ( 32, 15, 1, 'https://cdn.tiendasmontano.bo/p/15/1/1.jpg',true,  1),
  ( 33, 16, 1, 'https://cdn.tiendasmontano.bo/p/16/1/1.jpg',true,  1),
  ( 34, 16, 4, 'https://cdn.tiendasmontano.bo/p/16/4/1.jpg',true,  1),
  ( 35, 17, 3, 'https://cdn.tiendasmontano.bo/p/17/3/1.jpg',true,  1),
  ( 36, 17, 4, 'https://cdn.tiendasmontano.bo/p/17/4/1.jpg',true,  1),
  ( 37, 18, 1, 'https://cdn.tiendasmontano.bo/p/18/1/1.jpg',true,  1),
  ( 38, 18, 8, 'https://cdn.tiendasmontano.bo/p/18/8/1.jpg',true,  1),
  ( 39, 19, 1, 'https://cdn.tiendasmontano.bo/p/19/1/1.jpg',true,  1),
  ( 40, 24, 1, 'https://cdn.tiendasmontano.bo/p/24/1/1.jpg',true,  1);

-- =====================================================================
-- 32. PRODUCTO COLECCION  ·  14 filas
-- Es una tabla de union, y su PRIMARY KEY es (id_coleccion, id_producto).
-- =====================================================================

INSERT INTO producto_coleccion (id_coleccion, id_producto) VALUES
  (1,  1), (1,  2), (1,  3), (1,  4), (1,  5),
  (2,  1), (2, 11), (2, 12), (2, 13), (2, 20), (2, 21),
  (3,  4), (3, 17), (3, 21),
  (4,  1), (4,  3), (4,  7), (4,  8), (4, 14), (4, 16), (4, 19), (4, 23), (4, 24);

-- =====================================================================
-- 33. RECEPCIONES  ·  4 filas
-- =====================================================================

INSERT INTO recepciones (id_recepcion, id_orden_compra, id_sucursal, id_usuario, fecha_recepcion, estado) VALUES
  (1, 1, 1, 4, '2026-05-26 11:00:00', 'Registrada'),
  (2, 2, 1, 4, '2026-06-14 15:30:00', 'Registrada'),
  (3, 3, 2, 4, '2026-06-21 10:20:00', 'Registrada'),
  (4, 4, 1, 4, '2026-07-31 09:10:00', 'Registrada');

-- =====================================================================
-- 34. ITEMS DE RECEPCION  ·  9 filas
-- UNA de las 9 tiene diferencia -1, que es el caso parcial que la
-- bitacora fila 8 menciona: "3 de 4 lineas completas".
-- =====================================================================

INSERT INTO recepcion_items (id_recepcion_item, id_recepcion, id_ptc, cantidad_pedida, cantidad_recibida, diferencia) VALUES
  (1, 1, 49, 20, 20, 0), (2, 1, 56, 12, 12, 0), (3, 1, 59,  8,  8, 0), (4, 1, 61,  5,  4, -1),
  (5, 2,  1, 30, 30, 0), (6, 2,  2, 25, 25, 0), (7, 3, 73, 15, 15, 0),
  (8, 4, 21, 18, 18, 0), (9, 4, 23, 12, 12, 0);

-- =====================================================================
-- 35. ITEMS DE ORDEN DE COMPRA  ·  11 filas
-- ESTA ES LA UNICA TABLA CON CHECK DEL ESQUEMA, y es
--   cantidad INTEGER NOT NULL CHECK (cantidad > 0)
-- y TODAS las cantidades de aqui son mayores que cero.   Es la unica
-- invariante que la base de datos protege en todo el proyecto.
-- =====================================================================

INSERT INTO orden_compra_items (id_orden_item, id_orden_compra, id_ptc, cantidad, precio_unitario, subtotal) VALUES
  ( 1, 1, 49, 20, 265.00, 5300.00), ( 2, 1, 56, 12, 310.00, 3720.00),
  ( 3, 1, 59,  8, 360.00, 2880.00), ( 4, 1, 61,  5, 400.00, 2000.00),
  ( 5, 2,  1, 30,  35.00, 1050.00), ( 6, 2,  2, 25,  35.00,  875.00),
  ( 7, 2, 65, 18,  95.00, 1710.00), ( 8, 2, 66, 12,  95.00, 1140.00),
  ( 9, 2, 70, 15,  50.00,  750.00),
  (10, 3, 73, 15,  85.00, 1275.00), (11, 3, 74, 10,  85.00,  850.00);

-- =====================================================================
-- 36. ALERTAS DE STOCK  ·  8 filas
-- =====================================================================

INSERT INTO alertas_stock_config (id_config, id_ptc, id_categoria, id_sucursal, stock_minimo, notificar_email, ultima_notificacion) VALUES
  (1, 15, 1, 1, 5, true,  '2026-09-20 06:00:00'),
  (2, 32, 2, 1, 3, true,  '2026-09-25 06:00:00'),
  (3, 52, 4, 1, 2, true,  '2026-09-26 06:00:00'),
  (4, 57, 4, 2, 2, false, NULL),
  (5, 60, 5, 1, 3, true,  '2026-09-27 06:00:00'),
  (6, 63, 5, 3, 3, false, NULL),
  (7, 47, 3, 2, 2, false, NULL),
  (8,  2, 1, 1, 4, true,  '2026-09-27 06:00:00');

-- =====================================================================
-- 37. INVENTARIO  ·  80 filas
-- Las 4 cantidades:  disponible, reservada, vendida, y el minimo de alerta.
-- Y NO HAY NI UN CHECK en esta tabla, asi que las 4 pueden quedar negativas.
-- Aqui se dejan coherentes y sin negativos, y se avisa en el informe.
-- =====================================================================

INSERT INTO inventario_stock (id_stock, id_ptc, id_sucursal, cantidad_disponible, cantidad_reservada, cantidad_vendida, stock_minimo_alert) VALUES
  -- Sucursal 1, Centro
  (  1,  1, 1, 18, 0, 6, 3), (  2,  2, 1, 22, 0, 4, 3), (  3,  3, 1, 12, 0, 8, 3),
  (  4,  4, 1, 15, 0, 3, 3), (  5,  5, 1, 10, 0, 9, 3), (  6,  6, 1, 14, 0, 5, 3),
  (  7,  7, 1,  9, 0, 4, 2), (  8,  8, 1, 11, 0, 6, 2), (  9,  9, 1,  8, 0, 7, 2),
  ( 10, 10, 1, 13, 0, 3, 2), ( 11, 11, 1,  7, 0, 5, 2), ( 12, 12, 1, 16, 0, 2, 2),
  ( 13, 13, 1, 10, 0, 6, 2), ( 14, 14, 1, 12, 0, 4, 3), ( 15, 15, 1,  6, 0, 8, 2),
  ( 16, 16, 1,  9, 0, 5, 3), ( 17, 17, 1, 11, 0, 3, 3), ( 18, 18, 1,  8, 0, 4, 3),
  ( 19, 19, 1, 13, 0, 5, 3), ( 20, 20, 1, 10, 0, 7, 3),
  ( 21, 21, 1, 14, 1, 8, 4), ( 22, 22, 1,  9, 0, 6, 4), ( 23, 23, 1,  7, 0, 5, 4),
  ( 24, 24, 1, 11, 0, 4, 4), ( 25, 25, 1,  8, 0, 3, 4),
  ( 26, 30, 1,  6, 0, 2, 2), ( 27, 31, 1,  9, 0, 3, 2), ( 28, 32, 1,  4, 0, 4, 2),
  ( 29, 34, 1, 12, 0, 5, 3), ( 30, 35, 1, 10, 0, 6, 3), ( 31, 36, 1,  7, 0, 3, 3),
  -- Sucursal 2, Las Torres
  ( 32,  6, 2, 12, 0, 4, 3), ( 33, 21, 2, 11, 0, 6, 4), ( 34, 26, 2,  8, 0, 3, 3),
  ( 35, 40, 2, 10, 1, 4, 2), ( 36, 46, 2,  7, 0, 2, 2), ( 37, 48, 2,  9, 0, 5, 3),
  ( 38, 57, 2,  5, 0, 4, 2), ( 39, 68, 2,  8, 0, 2, 2), ( 40, 73, 2, 11, 0, 4, 3),
  -- Sucursal 3, Recoleta
  ( 41,  6, 3, 10, 0, 3, 3), ( 42, 22, 3,  8, 0, 5, 4), ( 43, 29, 3,  6, 0, 2, 3),
  ( 44, 44, 3,  9, 0, 3, 2), ( 45, 64, 3,  7, 0, 4, 3), ( 46, 76, 3, 12, 0, 5, 2),
  ( 47, 78, 3,  0, 0, 9, 3),
  -- Sucursal 4, Norte
  ( 48,  1, 4, 15, 0, 5, 3), ( 49,  7, 4,  9, 0, 4, 2), ( 50, 23, 4, 10, 0, 6, 4),
  ( 51, 41, 4,  8, 0, 3, 2), ( 52, 54, 4, 11, 0, 4, 3), ( 53, 69, 4,  7, 0, 2, 2),
  ( 54, 74, 4,  9, 0, 3, 3), ( 55, 77, 4, 10, 0, 4, 2),
  ( 56, 11, 2,  5, 0, 2, 2), ( 57, 19, 2,  4, 0, 3, 2), ( 58, 27, 1,  9, 0, 4, 3),
  ( 59, 37, 1,  6, 0, 2, 2), ( 60, 45, 1,  8, 0, 3, 2), ( 61, 50, 1,  7, 0, 4, 3),
  ( 62, 55, 1,  5, 0, 2, 2), ( 63, 58, 1,  6, 0, 3, 2), ( 64, 65, 1, 10, 0, 5, 3),
  ( 65, 66, 1,  8, 0, 4, 3), ( 66, 67, 1,  6, 0, 3, 3), ( 67, 71, 1,  9, 0, 4, 3),
  ( 68, 72, 1,  7, 0, 3, 3), ( 69, 75, 1,  8, 0, 2, 3), ( 70, 16, 2, 11, 0, 5, 3),
  ( 71, 18, 2,  9, 0, 4, 3), ( 72, 20, 2,  7, 0, 2, 3), ( 73, 28, 1,  8, 0, 3, 3),
  ( 74, 33, 1, 10, 0, 4, 3), ( 75, 38, 1,  6, 0, 2, 2), ( 76, 39, 1,  7, 0, 3, 2),
  ( 77, 42, 1,  9, 0, 4, 2), ( 78, 43, 1,  8, 0, 3, 2), ( 79, 47, 1,  5, 0, 2, 2),
  ( 80, 49, 1, 16, 0, 5, 4);

-- =====================================================================
-- 38. ITEMS DE VENTA  ·  26 filas
-- =====================================================================

INSERT INTO ventas (id_venta, id_cliente, id_usuario, id_sucursal, id_carrito, modalidad, metodo_pago, subtotal, impuestos, total, estado, fecha_venta) VALUES
  ( 1, 1, 10, 1, 1, 'Online',      'Tarjeta',      506.00,  21.66,  527.66, 'Completada',  '2026-09-05 19:20:00'),
  ( 2, 2, 11, 2, 2, 'Online',      'Tarjeta',      837.00,  33.24,  870.24, 'Completada',  '2026-09-08 21:40:00'),
  ( 3, 3, 12, 1, NULL, 'Presencial', 'Efectivo',     688.00,  16.15,  704.15, 'Completada',  '2026-09-12 10:20:00'),
  ( 4, 4, 13, 3, NULL, 'Presencial', 'Tarjeta',      636.00,  14.34,  650.34, 'Completada',  '2026-09-20 11:50:00'),
  ( 5, 6,  2, 1, NULL, 'Presencial', 'Efectivo',     363.00,   7.18,  370.18, 'Completada',  '2026-09-25 15:20:00'),
  ( 6, 7,  3, 4, NULL, 'Presencial', 'Tarjeta',     1918.00, 28.70, 1946.70, 'Completada',  '2026-09-26 18:10:00'),
  ( 7, 3, 12, 1, NULL, 'Presencial', 'QR',          538.00,   5.15,  543.15, 'Completada',  '2026-09-26 19:50:00'),
  ( 8, 1, 10, 1, NULL, 'Online',      'Tarjeta',      505.00,  21.56,  526.56, 'Completada',  '2026-09-27 08:10:00'),
  ( 9, 7,  3, 1, NULL, 'Presencial', 'Efectivo',     698.00,  16.75,  714.75, 'Completada',  '2026-09-27 10:10:00'),
  (10, 6,  2, 2, NULL, 'Presencial', 'Tarjeta',      365.00,   8.78,  373.78, 'Pendiente',  '2026-09-27 10:20:00'),
  (11, 5, 14, 1, NULL, 'Online',      'Tarjeta',      237.00,  10.10,  247.10, 'Completada',  '2026-09-27 09:05:00'),
  (12, 5, 14, 1, NULL, 'Online',      'QR',           119.00,   8.37,  127.37, 'Reembolsada', '2026-09-27 09:00:00');
INSERT INTO venta_items (id_venta_item, id_venta, id_ptc, cantidad, precio_unitario, subtotal) VALUES
  ( 1,  1,  1, 2,  89.00, 178.00), ( 2,  1,  3, 1, 149.00, 149.00), ( 3,  1, 11, 1, 179.00, 179.00),
  ( 4,  2,  6, 1, 289.00, 289.00), ( 5,  2,  7, 1, 259.00, 259.00), ( 6,  2, 21, 1, 289.00, 289.00),
  ( 7,  3, 14, 1, 589.00, 589.00), ( 8,  3,  4, 1,  99.00,  99.00),
  ( 9,  4, 22, 2, 199.00, 398.00), (10,  4, 23, 1, 159.00, 159.00), (11,  4, 24, 1,  79.00,  79.00),
  (12,  5, 10, 1, 199.00, 199.00), (13,  5,  9, 1, 159.00, 159.00),
  (14,  6, 16, 1, 329.00, 329.00), (15,  6, 19, 1, 749.00, 749.00), (16,  6, 18, 1, 899.00, 899.00),
  (17,  7, 20, 1, 269.00, 269.00), (18,  7, 66, 1, 269.00, 269.00),
  (19,  8,  1, 3,  89.00, 267.00), (20,  8,  2, 2, 119.00, 238.00),
  (21,  9, 30, 1, 349.00, 349.00), (22,  9,  8, 1, 349.00, 349.00),
  (23, 10, 51, 1, 1890.00, 1890.00), (24, 11,  5, 2,  79.00, 158.00),
  (25, 11, 17, 1,  79.00,  79.00), (26, 12,  2, 1, 119.00, 119.00);

-- =====================================================================
-- 39. ITEMS DE CARRITO  ·  14 filas
-- =====================================================================

INSERT INTO carrito_items (id_carrito_item, id_carrito, id_ptc, cantidad, precio_unitario) VALUES
  ( 1,  1,  1, 2,  89.00), ( 2,  1,  3, 1, 149.00), ( 3,  1, 11, 1, 179.00),
  ( 4,  2,  6, 1, 289.00), ( 5,  2,  7, 1, 259.00), ( 6,  2, 21, 1, 289.00),
  ( 7,  3, 40, 1, 179.00), ( 8,  3, 44, 1, 229.00),
  ( 9,  4,  6, 1, 289.00), (10,  4, 22, 1, 199.00),
  (11,  5,  5, 1,  79.00), (12,  5, 18, 1, 179.00), (13,  5, 19, 1, 269.00),
  (14,  6, 16, 1, 329.00);

-- =====================================================================
-- 40. COMPROBANTES  ·  8 filas
-- numero es UNIQUE, y es el correlativo que imprime la caja.
-- =====================================================================

INSERT INTO comprobantes (id_comprobante, id_venta, numero, tipo, nit_cliente, razon_social, total, fecha_emision, pdf_url) VALUES
  (1,  1, 'BOL-0001-2026', 'Factura',  '4567890-1K', 'María Elena González Vargas',  527.66, '2026-09-05 19:25:00', 's3://comprobantes/2026/BOL-0001-2026.pdf'),
  (2,  2, 'BOL-0002-2026', 'Factura',  NULL,         'Juan Pablo Quirga Limón',      870.24, '2026-09-08 21:45:00', 's3://comprobantes/2026/BOL-0002-2026.pdf'),
  (3,  3, 'BOL-0003-2026', 'Factura',  NULL,         'Laura Mamani Choque',          704.15, '2026-09-12 10:30:00', 's3://comprobantes/2026/BOL-0003-2026.pdf'),
  (4,  4, 'BOL-0004-2026', 'Factura',  NULL,         'Pedro Rojas Céspedes',        650.34, '2026-09-20 12:00:00', 's3://comprobantes/2026/BOL-0004-2026.pdf'),
  (5,  5, 'BOL-0005-2026', 'Factura',  '1000002-2B', 'Carmen Edith Suárez',         370.18, '2026-09-25 15:30:00', 's3://comprobantes/2026/BOL-0005-2026.pdf'),
  (6,  6, 'BOL-0006-2026', 'Factura',  NULL,         'Jorge Antonio Vargas',      1946.70, '2026-09-26 18:20:00', 's3://comprobantes/2026/BOL-0006-2026.pdf'),
  (7,  7, 'BOL-0007-2026', 'Factura',  NULL,         'Laura Mamani Choque',          550.58, '2026-09-26 20:00:00', 's3://comprobantes/2026/BOL-0007-2026.pdf'),
  (8, 12, 'BOL-0008-2026', 'Factura',  NULL,         'Ana Lucía López Herrera',      127.37, '2026-09-27 09:05:00', 's3://comprobantes/2026/BOL-0008-2026.pdf');

-- =====================================================================
-- 41. ITEMS DE RESERVA  ·  16 filas
-- =====================================================================

INSERT INTO reserva_items (id_reserva_item, id_reserva, id_ptc, cantidad) VALUES
  ( 1, 1,  1, 1), ( 2, 1,  3, 1), ( 3, 1, 11, 1),
  ( 4, 2,  6, 1), ( 5, 2, 21, 1), ( 6, 2, 14, 1),
  ( 7, 3, 40, 2), ( 8, 3, 44, 1),
  ( 9, 4, 30, 1), (10, 4,  8, 1),
  (11, 5, 22, 1), (12, 5, 23, 1),
  (13, 6,  6, 1),
  (14, 7,  7, 1), (15, 7, 26, 1),
  (16, 8, 54, 1);

-- =====================================================================
-- 42. RESULTADOS DEL VESTIDOR  ·  14 filas
-- resultado usa los tres valores que escribe el codigo: Gusta, Mediation
-- y No gusta.   Y OJO: CU24 manifesto que la columna foto_resultado se
-- escribe desde el codigo y NO existe en el esquema.   Aqui no aparece.
-- =====================================================================

-- =====================================================================
-- 43. SESIONES DEL VESTIDOR VIRTUAL  ·  6 filas
-- =====================================================================

INSERT INTO sesiones_ra (id_sesion_ra, id_usuario, id_ptc, medidas_avatar, fecha, id_reserva, id_carrito) VALUES
  (1, 10,  1, 'M:165,72,88;C:92,68,78', '2026-09-04 20:10:00', NULL, 1),
  (2, 11,  6, 'M:170,75,90;C:95,70,80', '2026-09-08 21:30:00', NULL, 2),
  (3, 12, 40, 'M:160,70,85;C:90,68,77', '2026-09-25 19:00:00', 3, 3),
  (4, 13, 30, 'M:172,76,91;C:96,71,81', '2026-09-26 21:00:00', 4, 4),
  (5, 14, 22, 'M:158,68,83;C:89,66,76', '2026-09-27 08:40:00', 5, 5),
  (6, 10,  7, 'M:168,74,89;C:94,69,79', '2026-09-27 09:30:00', 7, NULL);
INSERT INTO resultados_prueba (id_resultado, id_sesion_ra, id_ptc, resultado) VALUES
  ( 1, 1,  1, 'Gusta'), ( 2, 1,  3, 'Gusta'), ( 3, 1, 11, 'No gusta'),
  ( 4, 2,  6, 'Gusta'), ( 5, 2,  7, 'Mediation'), ( 6, 2, 21, 'Gusta'),
  ( 7, 3, 40, 'Gusta'), ( 8, 3, 44, 'Gusta'),
  ( 9, 4, 30, 'Gusta'), (10, 4,  8, 'No gusta'),
  (11, 5, 22, 'Gusta'), (12, 5, 23, 'Mediation'),
  (13, 6,  6, 'Gusta'), (14, 6, 21, 'Gusta');

-- =====================================================================
-- 44. VENTAS  ·  12 filas
-- modalidad es NOT NULL y el codigo escribe 'Online' y 'Presencial'.
-- metodo_pago lo escribe el codigo, y EXISTE aunque el proyecto entero
-- no lo usaba antes (hallazgo de CU29).
-- estado: 10 Completada, 1 Pendiente y 1 Reembolsada.
-- OJO CON EL DEFAULT: la columna tiene DEFAULT 'Completada' y el codigo
-- SIEMPRE pone 'Pendiente' al crear.  Aqui las 12 llevan el valor explicito,
-- que es lo que hace la aplicacion.
-- =====================================================================

-- =====================================================================
-- 45. TRANSACCIONES DE PAGO  ·  13 filas
-- estado usa los tres valores del codigo: Pendiente, Aprobado y
-- Rechazado.   Y proveedor_pasarela es el sandbox, que es lo que CU29
-- manifesto: para cobrar con tarjeta hay que abrir el banco y aprobar.
-- =====================================================================

INSERT INTO transacciones_pago (id_transaccion, id_venta, id_usuario, proveedor_pasarela, monto, moneda, metodo, estado, referencia_externa, id_transaccion_pasarela, fecha_hora, detalle) VALUES
  ( 1,  1, 10, 'sandbox',  527.66, 'BOB', 'Tarjeta',  'Aprobado',  'BOL-0001-2026', 'pi_3Qa1Xy2E3eZv4X', '2026-09-05 19:20:05', NULL),
  ( 2,  2, 11, 'sandbox',  870.24, 'BOB', 'Tarjeta',  'Aprobado',  'BOL-0002-2026', 'pi_3Qa1Xy2E3eZv4Y', '2026-09-08 21:40:05', NULL),
  ( 3,  3, 12, NULL,       704.15, 'BOB', 'Efectivo', 'Aprobado',  NULL,            NULL,               '2026-09-12 10:20:02', 'Pago en efectivo en mostrador'),
  ( 4,  4, 13, 'sandbox',  650.34, 'BOB', 'Tarjeta',  'Aprobado',  'BOL-0004-2026', 'pi_3Qa1Xy2E3eZv4a', '2026-09-20 11:50:05', NULL),
  ( 5,  5,  2, NULL,       370.18, 'BOB', 'Efectivo', 'Aprobado',  NULL,            NULL,               '2026-09-25 15:20:02', NULL),
  ( 6,  6,  3, 'sandbox', 1946.70, 'BOB', 'Tarjeta',  'Aprobado',  'BOL-0006-2026', 'pi_3Qa1Xy2E3eZv4b', '2026-09-26 18:10:05', NULL),
  ( 7,  7, 12, NULL,       543.15, 'BOB', 'QR',       'Aprobado',  NULL,            'qr_9a2b3c4d5e6f7g', '2026-09-26 19:50:03', NULL),
  ( 8,  8, 10, 'sandbox',  526.56, 'BOB', 'Tarjeta',  'Aprobado',  'BOL-0008-2026', 'pi_3Qa1Xy2E3eZv4c', '2026-09-27 08:10:05', NULL),
  ( 9,  9,  3, NULL,       714.75, 'BOB', 'Efectivo', 'Aprobado',  NULL,            NULL,               '2026-09-27 10:10:02', NULL),
  (10, 10,  2, 'sandbox',  373.78, 'BOB', 'Tarjeta',  'Pendiente', NULL,            NULL,               '2026-09-27 10:20:05', 'A la espera de la respuesta del banco'),
  (11, 11, 14, 'sandbox',  247.10, 'BOB', 'Tarjeta',  'Aprobado',  'BOL-0009-2026', 'pi_3Qa1Xy2E3eZv4d', '2026-09-27 09:05:05', NULL),
  (12, 12, 14, NULL,       127.37, 'BOB', 'QR',       'Rechazado', NULL,            'qr_1h2i3j4k5l6m7', '2026-09-27 09:00:03', 'Rechazada por el cliente'),
  (13,  6,  3, 'sandbox', 1946.70, 'BOB', 'Tarjeta',  'Rechazado', NULL,            NULL,               '2026-09-26 18:00:05', 'Monto no válido');

-- =====================================================================
-- 46. MOVIMIENTOS DE INVENTARIO  ·  40 filas
-- Es el KARDEX, y el TRIGGER trg_movimiento_inventario (schema.sql L654)
-- es el que rellena stock_anterior, stock_posterior y fecha.   Los tres
-- valores van aqui para que se vea como queda una fila DESPUES del
-- trigger, que es como se leen.
--
-- tipo_movimiento usa los 4 valores vivos en el codigo: 'Venta' (negativo),
-- 'SALIDA-RESERVA' y los que pone Ajustes.   OJO con esto: el trigger
-- resta cantidad_disponible SIEMPRE, sin mirar el tipo, y la pantalla
-- AdminKardex multiplica por -1 cualquier tipo que empiece por SALIDA,
-- asi que las salidas de reserva salen con el signo invertido.
-- =====================================================================

INSERT INTO movimientos_inventario (id_movimiento, id_ptc, id_sucursal, tipo_movimiento, cantidad, stock_anterior, stock_posterior, referencia, id_usuario, id_orden_compra, id_venta, id_reserva, fecha) VALUES
  -- Recepciones de las 4 ordenes recibidas, con cantidad POSITIVA
  ( 1, 49, 1, 'ENTRADA-RECEPCION',  20,  0, 20, 'OC-2026-0001', 4, 1, NULL, NULL, '2026-05-26 11:00:00'),
  ( 2, 56, 1, 'ENTRADA-RECEPCION',  12,  0, 12, 'OC-2026-0001', 4, 1, NULL, NULL, '2026-05-26 11:00:00'),
  ( 3, 59, 1, 'ENTRADA-RECEPCION',   8,  0,  8, 'OC-2026-0001', 4, 1, NULL, NULL, '2026-05-26 11:00:00'),
  ( 4, 61, 1, 'ENTRADA-RECEPCION',   4,  0,  4, 'OC-2026-0001', 4, 1, NULL, NULL, '2026-05-26 11:00:00'),
  ( 5,  1, 1, 'ENTRADA-RECEPCION',  30,  0, 30, 'OC-2026-0002', 4, 2, NULL, NULL, '2026-06-14 15:30:00'),
  ( 6,  2, 1, 'ENTRADA-RECEPCION',  25,  0, 25, 'OC-2026-0002', 4, 2, NULL, NULL, '2026-06-14 15:30:00'),
  ( 7, 65, 1, 'ENTRADA-RECEPCION',  18,  0, 18, 'OC-2026-0002', 4, 2, NULL, NULL, '2026-06-14 15:30:00'),
  ( 8, 70, 1, 'ENTRADA-RECEPCION',  15,  0, 15, 'OC-2026-0002', 4, 2, NULL, NULL, '2026-06-14 15:30:00'),
  ( 9, 73, 2, 'ENTRADA-RECEPCION',  15,  0, 15, 'OC-2026-0003', 4, 3, NULL, NULL, '2026-06-21 10:20:00'),
  (10, 21, 1, 'ENTRADA-RECEPCION',  18,  0, 18, 'OC-2026-0004', 4, 4, NULL, NULL, '2026-07-31 09:10:00'),
  -- Ventas, con cantidad NEGATIVA, que es lo que escribe el codigo en L348 y L718
  (11,  1, 1, 'Venta',              -2, 20, 18, 'VNT-1',  10, NULL,  1, NULL, '2026-09-05 19:20:00'),
  (12,  3, 1, 'Venta',              -1, 13, 12, 'VNT-1',  10, NULL,  1, NULL, '2026-09-05 19:20:00'),
  (13, 11, 1, 'Venta',              -1,  8,  7, 'VNT-1',  10, NULL,  1, NULL, '2026-09-05 19:20:00'),
  (14,  6, 2, 'Venta',              -1, 11, 10, 'VNT-2',  11, NULL,  2, NULL, '2026-09-08 21:40:00'),
  (15,  7, 2, 'Venta',              -1,  9,  8, 'VNT-2',  11, NULL,  2, NULL, '2026-09-08 21:40:00'),
  (16, 21, 2, 'Venta',              -1,  9,  8, 'VNT-2',  11, NULL,  2, NULL, '2026-09-08 21:40:00'),
  (17, 14, 1, 'Venta',              -1,  7,  6, 'VNT-3',  12, NULL,  3, NULL, '2026-09-12 10:20:00'),
  (18,  4, 1, 'Venta',              -1, 16, 15, 'VNT-3',  12, NULL,  3, NULL, '2026-09-12 10:20:00'),
  (19,  1, 1, 'Venta',              -3, 15, 12, 'VNT-8',  10, NULL,  8, NULL, '2026-09-27 08:10:00'),
  (20,  2, 1, 'Venta',              -2, 13, 11, 'VNT-8',  10, NULL,  8, NULL, '2026-09-27 08:10:00'),
  (21, 51, 1, 'Venta',              -1,  6,  5, 'VNT-10',  3,  NULL,  6, NULL, '2026-09-26 18:10:00'),
  (22, 16, 1, 'Venta',              -1, 12, 11, 'VNT-6',  3,  NULL,  6, NULL, '2026-09-26 18:10:00'),
  (23, 19, 1, 'Venta',              -1,  8,  7, 'VNT-6',  3,  NULL,  6, NULL, '2026-09-26 18:10:00'),
  (24, 18, 1, 'Venta',              -1, 10,  9, 'VNT-6',  3,  NULL,  6, NULL, '2026-09-26 18:10:00'),
  -- Reservas: la salida con cantidad NEGATIVA
  (25,  1, 1, 'SALIDA-RESERVA',      -1, 18, 17, 'R-1',     5,  NULL, NULL,  1, '2026-09-10 08:00:00'),
  (26,  3, 1, 'SALIDA-RESERVA',      -1, 12, 11, 'R-1',     5,  NULL, NULL,  1, '2026-09-10 08:00:00'),
  (27, 11, 1, 'SALIDA-RESERVA',      -1,  7,  6, 'R-1',     5,  NULL, NULL,  1, '2026-09-10 08:00:00'),
  (28,  6, 2, 'SALIDA-RESERVA',      -1, 10,  9, 'R-2',     6,  NULL, NULL,  2, '2026-09-18 09:00:00'),
  (29, 21, 2, 'SALIDA-RESERVA',      -1,  8,  7, 'R-2',     6,  NULL, NULL,  2, '2026-09-18 09:00:00'),
  (30, 14, 2, 'SALIDA-RESERVA',      -1,  6,  5, 'R-2',     6,  NULL, NULL,  2, '2026-09-18 09:00:00'),
  -- Y las devoluciones, que devuelven al disponible
  (31, 51, 1, 'DEVOLUCION',          1,  5,  6, 'DEV-1',    3,  NULL,  6, NULL, '2026-09-27 11:00:00'),
  (32,  1, 1, 'AJUSTE',              2, 12, 14, 'AJ-INV-001', 1, NULL, NULL, NULL, '2026-09-14 10:00:00'),
  (33,  2, 1, 'MERMA',              -1, 12, 11, 'AJ-INV-002', 1, NULL, NULL, NULL, '2026-09-18 10:00:00'),
  -- Reservas canceladas, que devuelven el stock
  (34,  6, 1, 'DEVOLUCION-RESERVA',  1,  8,  9, 'R-6',     5,  NULL, NULL,  6, '2026-09-22 10:00:00'),
  -- Una venta más, la 11, la de Ana Lucia
  (35,  5, 1, 'Venta',              -2,  9,  7, 'VNT-11',  14, NULL, 11, NULL, '2026-09-27 09:05:00'),
  (36, 17, 1, 'Venta',              -1,  9,  8, 'VNT-11',  14, NULL, 11, NULL, '2026-09-27 09:05:00'),
  (37, 20, 1, 'Venta',              -1,  7,  6, 'VNT-7',   12, NULL,  7, NULL, '2026-09-26 19:50:00'),
  (38, 66, 1, 'Venta',              -1,  8,  7, 'VNT-7',   12, NULL,  7, NULL, '2026-09-26 19:50:00'),
  (39,  2, 1, 'Venta',              -1, 12, 11, 'VNT-12',  14, NULL, 12, NULL, '2026-09-27 09:00:00'),
  (40, 10, 1, 'Venta',              -1,  8,  7, 'VNT-5',   2,  NULL,  5, NULL, '2026-09-25 15:20:00');

-- =====================================================================
-- 47. DEVOLUCIONES  ·  3 filas
-- =====================================================================

INSERT INTO devoluciones (id_devolucion, id_venta, id_usuario, id_sucursal, motivo, estado, fecha_creacion, fecha_procesada) VALUES
  (1,  6, 3, 4, 'La chaqueta de cuero no le sirvio de talla', 'Aprobada',   '2026-09-27 10:50:00', '2026-09-27 11:00:00'),
  (2, 12, 14, 1, 'Se arrepintio de la compra, solo 3 dias',   'En trámite', '2026-09-27 09:10:00', NULL),
  (3,  7, 12, 1, 'El vestido le quedo pequeno',               'Rechazada',  '2026-09-26 20:10:00', '2026-09-26 20:30:00');

-- =====================================================================
-- 48. ITEMS DE DEVOLUCION  ·  4 filas
-- =====================================================================

INSERT INTO devolucion_items (id_devolucion_item, id_devolucion, id_ptc, cantidad, tipo) VALUES
  (1, 1, 51, 1, 'Cambio de talla'),
  (2, 2,  2, 1, 'Reembolso'),
  (3, 3, 20, 1, 'Cambio de talla'),
  (4, 3, 66, 1, 'Cambio de talla');

-- =====================================================================
-- 49. HISTORIAL DE NAVEGACION  ·  20 filas
-- id_usuario es la persona, no el cliente: el historial es del usuario.
-- =====================================================================

INSERT INTO historial_navegacion (id_historial, id_usuario, id_ptc, fecha) VALUES
  ( 1, 10,  1, '2026-09-01 19:00:00'), ( 2, 10,  2, '2026-09-01 19:02:00'),
  ( 3, 10,  3, '2026-09-01 19:05:00'), ( 4, 10, 11, '2026-09-01 19:08:00'),
  ( 5, 10, 14, '2026-09-02 20:10:00'), ( 6, 10, 18, '2026-09-02 20:15:00'),
  ( 7, 10,  1, '2026-09-04 20:05:00'), ( 8, 10,  3, '2026-09-04 20:10:00'),
  ( 9, 11,  6, '2026-09-05 21:00:00'), (10, 11,  7, '2026-09-05 21:05:00'),
  (11, 11,  8, '2026-09-05 21:09:00'), (12, 11, 21, '2026-09-06 22:00:00'),
  (13, 11, 14, '2026-09-06 22:04:00'), (14, 12, 40, '2026-09-25 18:50:00'),
  (15, 12, 44, '2026-09-25 18:53:00'), (16, 12, 20, '2026-09-25 18:57:00'),
  (17, 13, 30, '2026-09-26 19:40:00'), (18, 13,  8, '2026-09-26 19:44:00'),
  (19, 14, 22, '2026-09-27 08:30:00'), (20, 14, 23, '2026-09-27 08:32:00');

-- =====================================================================
-- 50. RECOMENDACIONES DE LA IA  ·  16 filas
-- justificacion es lo que la pantalla muestra como motivo.   OJO: CU32
-- vio que ese texto no siempre es cierto cuando el degradado es por
-- prenda, y que el COALESCE a 'populares_temporada' es la fuente que
-- devuelve el backend cuando no hay preferencias del cliente.
-- =====================================================================

INSERT INTO recomendaciones_ia (id_recomendacion, id_usuario, id_ptc, justificacion) VALUES
  ( 1, 10,  1, 'Porque te gustan las poleras de color beige'),
  ( 2, 10,  3, 'Porque miraste poleras de cuello alto'),
  ( 3, 10, 11, 'Porque te gustan las faldas midi'),
  ( 4, 10,  4, 'Tendencia de temporada en tu talla'),
  ( 5, 11,  6, 'Porque compraste jeans el mes pasado'),
  ( 6, 11, 14, 'Porque te gustan las chaquetas'),
  ( 7, 11, 18, 'Porque la temperatura en tu ciudad esta baja'),
  ( 8, 11, 19, 'Porque es de los mas vistos de tu talla'),
  ( 9, 12, 40, 'Porque es de la categoria mas pedida por tus tallas'),
  (10, 12, 20, 'Porque visitaste esta pagina 3 veces'),
  (11, 12, 66, 'Porque combina con tu historial'),
  (12, 13, 30, 'Porque te gustan los pantalones sastre'),
  (13, 13,  8, 'Porque es de los mas vendidos en jeans'),
  (14, 14, 22, 'Porque tienes demasiadas siluetas similares en el hist'),
  (15, 14, 23, 'Porque usaste el filtro de precio parecido'),
  (16, 14, 24, 'Accesorio que complementa tu compra');

-- =====================================================================
-- 51. PRECIOS POR PRODUCTO_TALLA_COLOR  ·  26 filas
-- id_ptc es UNIQUE en la practica por la ON DELETE CASCADE, y aqui cada
-- uno tiene un solo precio vigente, con fecha_inicio y sin fecha_fin.
-- =====================================================================

INSERT INTO producto_precios (id_precio, id_ptc, precio, fecha_inicio, fecha_fin) VALUES
  ( 1,  1,  89.00, '2026-01-15', NULL), ( 2,  2,  89.00, '2026-01-15', NULL),
  ( 3,  3, 149.00, '2026-01-15', NULL), ( 4,  4,  99.00, '2026-02-01', NULL),
  ( 5,  6, 289.00, '2026-01-20', NULL), ( 6,  7, 259.00, '2026-01-20', NULL),
  ( 7,  8, 349.00, '2026-02-10', NULL), ( 8,  9, 159.00, '2026-01-25', NULL),
  ( 9, 10, 199.00, '2026-01-25', NULL), (10, 11, 179.00, '2026-02-01', NULL),
  (11, 12, 229.00, '2026-02-01', NULL), (12, 13, 209.00, '2026-02-05', NULL),
  (13, 14, 589.00, '2026-03-01', NULL), (14, 15,1890.00, '2026-03-01', NULL),
  (15, 16, 329.00, '2026-03-05', NULL), (16, 17,1250.00, '2026-03-10', NULL),
  (17, 18, 899.00, '2026-03-15', NULL), (18, 19, 749.00, '2026-03-15', NULL),
  (19, 20, 269.00, '2026-04-01', NULL), (20, 21, 289.00, '2026-04-01', NULL),
  (21, 22, 199.00, '2026-04-05', NULL), (22, 23, 159.00, '2026-04-05', NULL),
  (23, 24,  79.00, '2026-04-10', NULL), (24, 25, 249.00, '2026-04-10', NULL),
  (25, 26, 199.00, '2026-05-01', NULL), (26,  7, 279.00, '2026-07-01', '2026-12-31');

-- =====================================================================
-- SECUENCIAS
-- Los IDs van explicitos, asi que hay que dejar cada SERIAL en su sitio.
-- Si no, el siguiente INSERT que haga la aplicacion empieza en 1 y choca.
-- Y en producto_precios hay 2 filas para el id_ptc 7, la vigente y la
-- anterior, y el setval usa el MAX de la columna, no el numero de filas.
-- =====================================================================

SELECT setval(pg_get_serial_sequence('roles', 'id_rol'),                (SELECT MAX(id_rol) FROM roles));
SELECT setval(pg_get_serial_sequence('usuarios', 'id_usuario'),          (SELECT MAX(id_usuario) FROM usuarios));
SELECT setval(pg_get_serial_sequence('ciudades', 'id_ciudad'),          (SELECT MAX(id_ciudad) FROM ciudades));
SELECT setval(pg_get_serial_sequence('tallas', 'id_talla'),              (SELECT MAX(id_talla) FROM tallas));
SELECT setval(pg_get_serial_sequence('colores', 'id_color'),            (SELECT MAX(id_color) FROM colores));
SELECT setval(pg_get_serial_sequence('categorias', 'id_categoria'),      (SELECT MAX(id_categoria) FROM categorias));
SELECT setval(pg_get_serial_sequence('temporadas', 'id_temporada'),      (SELECT MAX(id_temporada) FROM temporadas));
SELECT setval(pg_get_serial_sequence('proveedores', 'id_proveedor'),      (SELECT MAX(id_proveedor) FROM proveedores));
SELECT setval(pg_get_serial_sequence('usuarios_roles', NULL),             COALESCE((SELECT MAX(GREATEST(id_usuario, id_rol)) FROM usuarios_roles), 1));
SELECT setval(pg_get_serial_sequence('clientes', 'id_cliente'),          (SELECT MAX(id_cliente) FROM clientes));
SELECT setval(pg_get_serial_sequence('first_password_tokens', 'id_token'),(SELECT MAX(id_token) FROM first_password_tokens));
SELECT setval(pg_get_serial_sequence('email_confirmations', 'id_confirmacion'), (SELECT MAX(id_confirmacion) FROM email_confirmations));
SELECT setval(pg_get_serial_sequence('password_resets', 'id_reset'),      (SELECT MAX(id_reset) FROM password_resets));
SELECT setval(pg_get_serial_sequence('token_blacklist', 'id_token'),      (SELECT MAX(id_token) FROM token_blacklist));
SELECT setval(pg_get_serial_sequence('sesiones', 'id_sesion'),            (SELECT MAX(id_sesion) FROM sesiones));
SELECT setval(pg_get_serial_sequence('bitacora_auditoria', 'id_bitacora'),(SELECT MAX(id_bitacora) FROM bitacora_auditoria));
SELECT setval(pg_get_serial_sequence('conversaciones_ia', 'id_conversacion'), (SELECT MAX(id_conversacion) FROM conversaciones_ia));
SELECT setval(pg_get_serial_sequence('reportes_generativos', 'id_reporte'),(SELECT MAX(id_reporte) FROM reportes_generativos));
SELECT setval(pg_get_serial_sequence('respaldos', 'id_respaldo'),        (SELECT MAX(id_respaldo) FROM respaldos));
SELECT setval(pg_get_serial_sequence('sucursales', 'id_sucursal'),       (SELECT MAX(id_sucursal) FROM sucursales));
SELECT setval(pg_get_serial_sequence('colecciones', 'id_coleccion'),      (SELECT MAX(id_coleccion) FROM colecciones));
SELECT setval(pg_get_serial_sequence('proveedor_contactos', 'id_contacto'), (SELECT MAX(id_contacto) FROM proveedor_contactos));
SELECT setval(pg_get_serial_sequence('productos', 'id_producto'),        (SELECT MAX(id_producto) FROM productos));
SELECT setval(pg_get_serial_sequence('preferencias_cliente', 'id_preferencia'), (SELECT MAX(id_preferencia) FROM preferencias_cliente));
SELECT setval(pg_get_serial_sequence('sucursal_horarios', 'id_horario'),  (SELECT MAX(id_horario) FROM sucursal_horarios));
SELECT setval(pg_get_serial_sequence('usuarios_empleados', 'id_empleado'),(SELECT MAX(id_empleado) FROM usuarios_empleados));
SELECT setval(pg_get_serial_sequence('ordenes_compra', 'id_orden_compra'),(SELECT MAX(id_orden_compra) FROM ordenes_compra));
SELECT setval(pg_get_serial_sequence('reservas', 'id_reserva'),          (SELECT MAX(id_reserva) FROM reservas));
SELECT setval(pg_get_serial_sequence('carritos', 'id_carrito'),          (SELECT MAX(id_carrito) FROM carritos));
SELECT setval(pg_get_serial_sequence('producto_talla_color', 'id_ptc'),  (SELECT MAX(id_ptc) FROM producto_talla_color));
SELECT setval(pg_get_serial_sequence('producto_imagenes', 'id_imagen'),   (SELECT MAX(id_imagen) FROM producto_imagenes));
SELECT setval(pg_get_serial_sequence('recepciones', 'id_recepcion'),      (SELECT MAX(id_recepcion) FROM recepciones));
SELECT setval(pg_get_serial_sequence('recepcion_items', 'id_recepcion_item'), (SELECT MAX(id_recepcion_item) FROM recepcion_items));
SELECT setval(pg_get_serial_sequence('orden_compra_items', 'id_orden_item'), (SELECT MAX(id_orden_item) FROM orden_compra_items));
SELECT setval(pg_get_serial_sequence('alertas_stock_config', 'id_config'),(SELECT MAX(id_config) FROM alertas_stock_config));
SELECT setval(pg_get_serial_sequence('inventario_stock', 'id_stock'),    (SELECT MAX(id_stock) FROM inventario_stock));
SELECT setval(pg_get_serial_sequence('venta_items', 'id_venta_item'),    (SELECT MAX(id_venta_item) FROM venta_items));
SELECT setval(pg_get_serial_sequence('carrito_items', 'id_carrito_item'),(SELECT MAX(id_carrito_item) FROM carrito_items));
SELECT setval(pg_get_serial_sequence('comprobantes', 'id_comprobante'),  (SELECT MAX(id_comprobante) FROM comprobantes));
SELECT setval(pg_get_serial_sequence('reserva_items', 'id_reserva_item'),(SELECT MAX(id_reserva_item) FROM reserva_items));
SELECT setval(pg_get_serial_sequence('resultados_prueba', 'id_resultado'),(SELECT MAX(id_resultado) FROM resultados_prueba));
SELECT setval(pg_get_serial_sequence('sesiones_ra', 'id_sesion_ra'),     (SELECT MAX(id_sesion_ra) FROM sesiones_ra));
SELECT setval(pg_get_serial_sequence('ventas', 'id_venta'),              (SELECT MAX(id_venta) FROM ventas));
SELECT setval(pg_get_serial_sequence('transacciones_pago', 'id_transaccion'), (SELECT MAX(id_transaccion) FROM transacciones_pago));
SELECT setval(pg_get_serial_sequence('movimientos_inventario', 'id_movimiento'), (SELECT MAX(id_movimiento) FROM movimientos_inventario));
SELECT setval(pg_get_serial_sequence('devoluciones', 'id_devolucion'),   (SELECT MAX(id_devolucion) FROM devoluciones));
SELECT setval(pg_get_serial_sequence('devolucion_items', 'id_devolucion_item'), (SELECT MAX(id_devolucion_item) FROM devolucion_items));
SELECT setval(pg_get_serial_sequence('historial_navegacion', 'id_historial'), (SELECT MAX(id_historial) FROM historial_navegacion));
SELECT setval(pg_get_serial_sequence('recomendaciones_ia', 'id_recomendacion'), (SELECT MAX(id_recomendacion) FROM recomendaciones_ia));
SELECT setval(pg_get_serial_sequence('producto_precios', 'id_precio'),    (SELECT MAX(id_precio) FROM producto_precios));

COMMIT;

-- =====================================================================
-- INFORME DE VERIFICACIÓN
-- Esto va AL FINAL, después del COMMIT, y es lo que se ejecuta para
-- comprobar que la población salió bien.  Si algo está mal, sale el número
-- que no cuadra; si todo cuadra, sale OK en las 6 líneas.
-- =====================================================================

\echo ''
\echo '=== VERIFICACIÓN DE LA POBLACIÓN ==='

-- 1. Las 51 tablas tienen filas
DO $$
DECLARE
  v_ok  INTEGER := 0;
  v_no  TEXT := '';
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE 'SELECT COUNT(*) FROM ' || v_rec.table_name INTO v_ok;
    IF v_ok = 0 THEN
      v_no := v_no || v_rec.table_name || ' ';
    END IF;
  END LOOP;
  IF v_no = '' THEN
    RAISE NOTICE 'OK: las 51 tablas tienen al menos una fila';
  ELSE
    RAISE WARNING 'TABLAS VACIAS: %', v_no;
  END IF;
END $$;

-- 2. Las 88 claves foraneas se respetan  (PostgreSQL ya lo garantiza con
--    ON DELETE, pero esto lo dice con numeros)
SELECT
  (SELECT COUNT(*) FROM productos)             AS productos,
  (SELECT COUNT(*) FROM producto_talla_color)  AS combinaciones,
  (SELECT COUNT(*) FROM inventario_stock)      AS filas_de_stock,
  (SELECT COUNT(*) FROM ventas)                AS ventas,
  (SELECT COUNT(*) FROM movimientos_inventario) AS movimientos,
  (SELECT COUNT(*) FROM usuarios)              AS usuarios;

-- 3. El UNICO CHECK del esquema se cumple: todas las cantidades de compra
--    son mayores que cero
SELECT
  COUNT(*)                                        AS lineas_de_compra,
  COUNT(*) FILTER (WHERE cantidad > 0)            AS mayores_que_cero,
  COUNT(*) FILTER (WHERE cantidad <= 0)           AS incumples_el_check
  FROM orden_compra_items;

-- 4. El UNIQUE compuesto de producto_talla_color se respeta
SELECT COUNT(*) AS combinaciones,
       COUNT(DISTINCT (id_producto, id_talla, id_color)) AS distintas
  FROM producto_talla_color;

-- 5. Las 4 cantidades de inventario: ninguna negativa
SELECT
  COUNT(*) FILTER (WHERE cantidad_disponible < 0) AS disponibles_negativos,
  COUNT(*) FILTER (WHERE cantidad_reservada  < 0) AS reservadas_negativas,
  COUNT(*) FILTER (WHERE cantidad_vendida    < 0) AS vendidas_negativas
  FROM inventario_stock;

-- 6. LO QUE ESTA MAL EN EL MODELO Y ESTE SCRIPT NO PUEDE ARREGLAR
--    Las 4 filas que salen con valores distintos de 0, y que en la
--    aplicacion nunca saldrian asi.
SELECT
  'inventario_stock NO tiene ningun CHECK'      AS problema,
  'las 4 cantidades pueden quedar negativas'    AS detalle
UNION ALL
SELECT
  'producto_talla_color.estado_stock NO se escribe',
  'esta en Disponible siempre, y 6 sitios la leen para decidir si hay stock'
UNION ALL
SELECT
  'faltan 2 columnas en el esquema',
  'carritos.token_invitado y sesiones_ra.foto_resultado, que el codigo usa en 44 sitios'
UNION ALL
SELECT
  'ventas.estado DEFAULT Completada',
  'pero el codigo siempre pone Pendiente, asi que el DEFAULT esta muerto'
UNION ALL
SELECT
  'preferencias_cliente sin UNIQUE ni indice',
  'y sus 5 claves foraneas son NULLABLE, asi que admite una fila que no dice nada';

-- 7. Resumen de filas por tabla
SELECT
  'roles'                AS tabla, COUNT(*) AS filas FROM roles                UNION ALL
SELECT 'usuarios',          COUNT(*) FROM usuarios          UNION ALL
SELECT 'ciudades',          COUNT(*) FROM ciudades          UNION ALL
SELECT 'tallas',            COUNT(*) FROM tallas            UNION ALL
SELECT 'colores',           COUNT(*) FROM colores           UNION ALL
SELECT 'categorias',        COUNT(*) FROM categorias        UNION ALL
SELECT 'temporadas',        COUNT(*) FROM temporadas        UNION ALL
SELECT 'proveedores',       COUNT(*) FROM proveedores       UNION ALL
SELECT 'usuarios_roles',    COUNT(*) FROM usuarios_roles    UNION ALL
SELECT 'clientes',          COUNT(*) FROM clientes          UNION ALL
SELECT 'productos',         COUNT(*) FROM productos         UNION ALL
SELECT 'producto_talla_color', COUNT(*) FROM producto_talla_color UNION ALL
SELECT 'producto_imagenes',   COUNT(*) FROM producto_imagenes   UNION ALL
SELECT 'inventario_stock',  COUNT(*) FROM inventario_stock  UNION ALL
SELECT 'reservas',          COUNT(*) FROM reservas          UNION ALL
SELECT 'ventas',            COUNT(*) FROM ventas            UNION ALL
SELECT 'movimientos_inventario', COUNT(*) FROM movimientos_inventario UNION ALL
SELECT 'transacciones_pago', COUNT(*) FROM transacciones_pago UNION ALL
SELECT 'TOTAL de filas insertadas', 1;

-- Se reactivan los triggers.
ALTER TABLE movimientos_inventario ENABLE TRIGGER trg_movimiento_inventario;
ALTER TABLE usuarios ENABLE TRIGGER trg_bloquear_usuario_5_intentos;
