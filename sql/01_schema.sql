-- =====================================================================
-- TIENDAS MONTAÑO — ESQUEMA COMPLETO DE BASE DE DATOS (PostgreSQL 15+)
-- Plataforma Inteligente de E-Commerce de Ropa con Vestidor Virtual RA
-- =====================================================================
-- Este script crea TODA la estructura de la BD en un solo archivo:
--   1. Extensiones
--   2. Tablas (en orden de dependencias)
--   3. Índices
--   4. Datos iniciales (roles, tallas, colores, categorías)
--   5. Triggers y procedimientos almacenados
-- Puede ejecutarse completo en Supabase (SQL Editor) o en psql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONES
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- para gen_random_uuid() si se usa

-- ---------------------------------------------------------------------
-- 1. MÓDULO DE SEGURIDAD (RBAC) — CU01-CU10
-- ---------------------------------------------------------------------

CREATE TABLE roles (
    id_rol         SERIAL PRIMARY KEY,
    nombre_rol     VARCHAR(60) UNIQUE NOT NULL,
    descripcion    TEXT,
    permisos_json  JSONB NOT NULL DEFAULT '[]',
    estado         VARCHAR(20) DEFAULT 'Activo',
    fecha_creacion TIMESTAMP DEFAULT NOW()
);

CREATE TABLE usuarios (
    id_usuario          SERIAL PRIMARY KEY,
    email               VARCHAR(120) UNIQUE NOT NULL,
    ci                  VARCHAR(30) UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    estado              VARCHAR(20) DEFAULT 'Pendiente',
    intentos_fallidos   INTEGER DEFAULT 0,
    bloqueado_hasta     TIMESTAMP,
    fecha_creacion      TIMESTAMP DEFAULT NOW(),
    fecha_ultimo_acceso TIMESTAMP,
    ultimo_login        TIMESTAMP
);

CREATE TABLE usuarios_roles (
    id_usuario  INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    id_rol      INTEGER REFERENCES roles(id_rol) ON DELETE CASCADE,
    PRIMARY KEY (id_usuario, id_rol)
);

CREATE TABLE ciudades (
    id_ciudad SERIAL PRIMARY KEY,
    nombre    VARCHAR(80) UNIQUE NOT NULL,
    pais      VARCHAR(60) DEFAULT 'Bolivia',
    estado    VARCHAR(20) DEFAULT 'Activa'
);

CREATE TABLE sucursales (
    id_sucursal     SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    direccion       TEXT NOT NULL,
    id_ciudad       INTEGER REFERENCES ciudades(id_ciudad),
    telefono        VARCHAR(30),
    estado          VARCHAR(20) DEFAULT 'Activa',
    fecha_registro  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sucursal_horarios (
    id_horario        SERIAL PRIMARY KEY,
    id_sucursal       INTEGER REFERENCES sucursales(id_sucursal) ON DELETE CASCADE,
    dia_semana        VARCHAR(20),
    horario_apertura  TIME,
    horario_cierre    TIME
);

CREATE TABLE usuarios_empleados (
    id_empleado  SERIAL PRIMARY KEY,
    usuario_id   INTEGER UNIQUE REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    sucursal_id  INTEGER REFERENCES sucursales(id_sucursal),
    nombre       VARCHAR(120) NOT NULL,
    telefono     VARCHAR(30),
    rol          VARCHAR(60) NOT NULL,
    fecha_baja   TIMESTAMP,
    motivo_baja  VARCHAR(255)
);

CREATE TABLE clientes (
    id_cliente     SERIAL PRIMARY KEY,
    usuario_id     INTEGER UNIQUE REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    nombre         VARCHAR(150) NOT NULL,
    telefono       VARCHAR(30),
    direccion      TEXT,
    fecha_registro TIMESTAMP DEFAULT NOW()
);

CREATE TABLE first_password_tokens (
    id_token   SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    token      UUID UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used       BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE email_confirmations (
    id_confirmacion SERIAL PRIMARY KEY,
    usuario_id      INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    token           UUID UNIQUE NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    used            BOOLEAN DEFAULT false,
    confirmado_en   TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE password_resets (
    id_reset   SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    email      VARCHAR(120) NOT NULL,
    token      UUID UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used       BOOLEAN DEFAULT false,
    ip_origen  VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE token_blacklist (
    id_token     SERIAL PRIMARY KEY,
    jti          VARCHAR(128) UNIQUE NOT NULL,
    usuario_id   INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    expira_en    TIMESTAMP NOT NULL,
    revocado_en  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sesiones (
    id_sesion      SERIAL PRIMARY KEY,
    usuario_id     INTEGER REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    refresh_token  VARCHAR(255) UNIQUE,
    ip_origen      VARCHAR(45),
    user_agent     VARCHAR(255),
    fecha_inicio   TIMESTAMP DEFAULT NOW(),
    fecha_fin      TIMESTAMP,
    activa         BOOLEAN DEFAULT true
);

-- ---------------------------------------------------------------------
-- 2. MÓDULO DE AUDITORÍA — CU11
-- ---------------------------------------------------------------------
CREATE TABLE bitacora_auditoria (
    id_bitacora     SERIAL PRIMARY KEY,
    id_usuario      INTEGER REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    accion_sql      VARCHAR(40),
    tabla_afectada  VARCHAR(80),
    id_registro     INTEGER,
    detalle         TEXT,
    old_data        JSONB,
    new_data        JSONB,
    ip_address      INET,
    user_agent      VARCHAR(255),
    fecha_hora      TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 4. CATÁLOGO Y MAESTROS — CU14, CU15
-- ---------------------------------------------------------------------
CREATE TABLE tallas (
    id_talla SERIAL PRIMARY KEY,
    nombre   VARCHAR(10) UNIQUE NOT NULL,
    estado   VARCHAR(20) DEFAULT 'Activo',
    orden    INTEGER
);

CREATE TABLE colores (
    id_color   SERIAL PRIMARY KEY,
    nombre     VARCHAR(50) UNIQUE NOT NULL,
    codigo_hex VARCHAR(7) UNIQUE,
    estado     VARCHAR(20) DEFAULT 'Activo'
);

CREATE TABLE categorias (
    id_categoria SERIAL PRIMARY KEY,
    nombre       VARCHAR(80) UNIQUE NOT NULL,
    descripcion  TEXT,
    estado       VARCHAR(20) DEFAULT 'Activo'
);

CREATE TABLE temporadas (
    id_temporada  SERIAL PRIMARY KEY,
    nombre        VARCHAR(80) NOT NULL,
    fecha_inicio  DATE,
    fecha_fin     DATE,
    estado        VARCHAR(20) DEFAULT 'Programada'
);

-- ---------------------------------------------------------------------
-- 6. PROVEEDORES Y COMPRAS — CU18-CU22
-- ---------------------------------------------------------------------
CREATE TABLE proveedores (
    id_proveedor        SERIAL PRIMARY KEY,
    nombre_empresa      VARCHAR(150) UNIQUE NOT NULL,
    persona_contacto    VARCHAR(120),
    telefono            VARCHAR(30),
    email               VARCHAR(120) UNIQUE,
    direccion           TEXT,
    observaciones       TEXT,
    tiempo_entrega_dias INTEGER DEFAULT 15,
    estado_riesgo       VARCHAR(20) DEFAULT 'Activo',
    calidad_score       INTEGER,
    fecha_registro      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE proveedor_contactos (
    id_contacto  SERIAL PRIMARY KEY,
    id_proveedor INTEGER REFERENCES proveedores(id_proveedor) ON DELETE CASCADE,
    nombre       VARCHAR(120),
    cargo        VARCHAR(80),
    telefono     VARCHAR(30),
    email        VARCHAR(120)
);

-- ---------------------------------------------------------------------
-- 5. PRODUCTOS Y VARIANTES — CU13, CU16
-- ---------------------------------------------------------------------
CREATE TABLE productos (
    id_producto    SERIAL PRIMARY KEY,
    codigo         VARCHAR(40) UNIQUE NOT NULL,
    nombre         VARCHAR(150) NOT NULL,
    descripcion    TEXT,
    id_categoria   INTEGER REFERENCES categorias(id_categoria),
    id_temporada   INTEGER REFERENCES temporadas(id_temporada),
    id_proveedor   INTEGER REFERENCES proveedores(id_proveedor),
    precio_base    DECIMAL(10,2) NOT NULL,
    modelo_3d_url  TEXT,
    estado         VARCHAR(20) DEFAULT 'Disponible',
    fecha_registro TIMESTAMP DEFAULT NOW()
);

CREATE TABLE producto_talla_color (
    id_ptc        SERIAL PRIMARY KEY,
    id_producto   INTEGER REFERENCES productos(id_producto) ON DELETE CASCADE,
    id_talla      INTEGER REFERENCES tallas(id_talla),
    id_color      INTEGER REFERENCES colores(id_color),
    estado_stock  VARCHAR(20) DEFAULT 'Disponible',
    UNIQUE (id_producto, id_talla, id_color)
);

CREATE TABLE producto_imagenes (
    id_imagen    SERIAL PRIMARY KEY,
    id_producto  INTEGER REFERENCES productos(id_producto) ON DELETE CASCADE,
    id_color     INTEGER REFERENCES colores(id_color) ON DELETE SET NULL,
    url          TEXT NOT NULL,
    es_principal BOOLEAN DEFAULT false,
    orden        INTEGER
);

CREATE TABLE producto_precios (
    id_precio    SERIAL PRIMARY KEY,
    id_ptc       INTEGER REFERENCES producto_talla_color(id_ptc) ON DELETE CASCADE,
    precio       DECIMAL(10,2) NOT NULL,
    fecha_inicio DATE,
    fecha_fin    DATE
);

CREATE TABLE colecciones (
    id_coleccion   SERIAL PRIMARY KEY,
    nombre         VARCHAR(80) NOT NULL,
    descripcion    TEXT,
    id_temporada   INTEGER REFERENCES temporadas(id_temporada),
    fecha_creacion TIMESTAMP DEFAULT NOW()
);

CREATE TABLE producto_coleccion (
    id_coleccion INTEGER REFERENCES colecciones(id_coleccion) ON DELETE CASCADE,
    id_producto  INTEGER REFERENCES productos(id_producto) ON DELETE CASCADE,
    PRIMARY KEY (id_coleccion, id_producto)
);

CREATE TABLE ordenes_compra (
    id_orden_compra        SERIAL PRIMARY KEY,
    id_proveedor           INTEGER REFERENCES proveedores(id_proveedor),
    id_sucursal            INTEGER REFERENCES sucursales(id_sucursal),
    numero                 VARCHAR(20),
    fecha_orden            TIMESTAMP DEFAULT NOW(),
    fecha_estimada_entrega DATE,
    fecha_recepcion        TIMESTAMP,
    estado                 VARCHAR(20) DEFAULT 'Pendiente',
    total                  DECIMAL(12,2),
    observaciones          TEXT
);

CREATE TABLE orden_compra_items (
    id_orden_item   SERIAL PRIMARY KEY,
    id_orden_compra INTEGER REFERENCES ordenes_compra(id_orden_compra) ON DELETE CASCADE,
    id_ptc          INTEGER REFERENCES producto_talla_color(id_ptc),
    cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10,2),
    subtotal        DECIMAL(12,2)
);

-- ---------------------------------------------------------------------
-- 7. INVENTARIO — CU22-CU26
-- ---------------------------------------------------------------------
CREATE TABLE inventario_stock (
    id_stock            SERIAL PRIMARY KEY,
    id_ptc              INTEGER REFERENCES producto_talla_color(id_ptc),
    id_sucursal         INTEGER REFERENCES sucursales(id_sucursal),
    cantidad_disponible INTEGER DEFAULT 0,
    cantidad_reservada  INTEGER DEFAULT 0,
    cantidad_vendida    INTEGER DEFAULT 0,
    stock_minimo_alert  INTEGER DEFAULT 0,
    UNIQUE (id_ptc, id_sucursal)
);

CREATE TABLE recepciones (
    id_recepcion       SERIAL PRIMARY KEY,
    id_orden_compra    INTEGER REFERENCES ordenes_compra(id_orden_compra),
    id_sucursal        INTEGER REFERENCES sucursales(id_sucursal),
    id_usuario         INTEGER REFERENCES usuarios(id_usuario),
    fecha_recepcion    TIMESTAMP DEFAULT NOW(),
    estado             VARCHAR(20) DEFAULT 'Registrada'
);

CREATE TABLE recepcion_items (
    id_recepcion_item SERIAL PRIMARY KEY,
    id_recepcion      INTEGER REFERENCES recepciones(id_recepcion) ON DELETE CASCADE,
    id_ptc            INTEGER REFERENCES producto_talla_color(id_ptc),
    cantidad_pedida   INTEGER,
    cantidad_recibida INTEGER,
    diferencia        INTEGER
);

CREATE TABLE alertas_stock_config (
    id_config           SERIAL PRIMARY KEY,
    id_ptc              INTEGER REFERENCES producto_talla_color(id_ptc),
    id_categoria        INTEGER REFERENCES categorias(id_categoria),
    id_sucursal         INTEGER REFERENCES sucursales(id_sucursal),
    stock_minimo        INTEGER,
    notificar_email     BOOLEAN DEFAULT false,
    ultima_notificacion TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 8. RESERVAS — CU28-CU31
-- ---------------------------------------------------------------------
CREATE TABLE reservas (
    id_reserva       SERIAL PRIMARY KEY,
    id_cliente       INTEGER REFERENCES clientes(id_cliente),
    id_usuario       INTEGER REFERENCES usuarios(id_usuario),
    id_sucursal      INTEGER REFERENCES sucursales(id_sucursal),
    fecha_reserva    DATE,
    hora_reserva     TIME,
    estado           VARCHAR(20) DEFAULT 'Solicitada',
    id_encargado     INTEGER REFERENCES usuarios(id_usuario),
    fecha_creacion   TIMESTAMP DEFAULT NOW(),
    fecha_preparada  TIMESTAMP,
    fecha_atendida   TIMESTAMP
);

CREATE TABLE reserva_items (
    id_reserva_item SERIAL PRIMARY KEY,
    id_reserva      INTEGER REFERENCES reservas(id_reserva) ON DELETE CASCADE,
    id_ptc          INTEGER REFERENCES producto_talla_color(id_ptc),
    cantidad        INTEGER DEFAULT 1
);

-- ---------------------------------------------------------------------
-- 10. CARRITO Y VENTAS — CU33-CU39
-- ---------------------------------------------------------------------
CREATE TABLE carritos (
    id_carrito     SERIAL PRIMARY KEY,
    id_usuario     INTEGER REFERENCES usuarios(id_usuario),
    estado         VARCHAR(20) DEFAULT 'Activo',
    id_sucursal    INTEGER REFERENCES sucursales(id_sucursal),
    fecha_creacion TIMESTAMP DEFAULT NOW()
);

CREATE TABLE carrito_items (
    id_carrito_item SERIAL PRIMARY KEY,
    id_carrito      INTEGER REFERENCES carritos(id_carrito) ON DELETE CASCADE,
    id_ptc          INTEGER REFERENCES producto_talla_color(id_ptc),
    cantidad        INTEGER DEFAULT 1,
    precio_unitario DECIMAL(10,2)
);

CREATE TABLE ventas (
    id_venta     SERIAL PRIMARY KEY,
    id_cliente   INTEGER REFERENCES clientes(id_cliente),
    id_usuario   INTEGER REFERENCES usuarios(id_usuario),
    id_sucursal  INTEGER REFERENCES sucursales(id_sucursal),
    id_carrito   INTEGER REFERENCES carritos(id_carrito),
    modalidad    VARCHAR(20) NOT NULL,
    metodo_pago  VARCHAR(30),
    subtotal     DECIMAL(12,2),
    impuestos    DECIMAL(12,2),
    total        DECIMAL(12,2),
    estado       VARCHAR(20) DEFAULT 'Completada',
    fecha_venta  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE venta_items (
    id_venta_item   SERIAL PRIMARY KEY,
    id_venta        INTEGER REFERENCES ventas(id_venta) ON DELETE CASCADE,
    id_ptc          INTEGER REFERENCES producto_talla_color(id_ptc),
    cantidad        INTEGER,
    precio_unitario DECIMAL(10,2),
    subtotal        DECIMAL(12,2)
);

CREATE TABLE comprobantes (
    id_comprobante SERIAL PRIMARY KEY,
    id_venta       INTEGER REFERENCES ventas(id_venta),
    numero         VARCHAR(30) UNIQUE,
    tipo           VARCHAR(20),
    nit_cliente    VARCHAR(30),
    razon_social   VARCHAR(150),
    total          DECIMAL(12,2),
    fecha_emision  TIMESTAMP DEFAULT NOW(),
    pdf_url        TEXT
);

-- Movimientos de inventario (kardex)
CREATE TABLE movimientos_inventario (
    id_movimiento   SERIAL PRIMARY KEY,
    id_ptc          INTEGER REFERENCES producto_talla_color(id_ptc),
    id_sucursal     INTEGER REFERENCES sucursales(id_sucursal),
    tipo_movimiento VARCHAR(30),
    cantidad        INTEGER,
    stock_anterior  INTEGER,
    stock_posterior INTEGER,
    referencia      VARCHAR(120),
    id_usuario      INTEGER REFERENCES usuarios(id_usuario),
    id_orden_compra INTEGER REFERENCES ordenes_compra(id_orden_compra),
    id_venta        INTEGER REFERENCES ventas(id_venta),
    id_reserva      INTEGER REFERENCES reservas(id_reserva),
    fecha           TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 11. PASARELA DE PAGO — CU35
-- ---------------------------------------------------------------------
CREATE TABLE transacciones_pago (
    id_transaccion          SERIAL PRIMARY KEY,
    id_venta                INTEGER REFERENCES ventas(id_venta),
    id_usuario              INTEGER REFERENCES usuarios(id_usuario),
    proveedor_pasarela      VARCHAR(40),
    monto                   DECIMAL(12,2),
    moneda                  VARCHAR(3) DEFAULT 'BOB',
    metodo                  VARCHAR(30),
    estado                  VARCHAR(20) DEFAULT 'Pendiente',
    referencia_externa      VARCHAR(120),
    id_transaccion_pasarela VARCHAR(120),
    fecha_hora              TIMESTAMP DEFAULT NOW(),
    detalle                 TEXT
);

-- ---------------------------------------------------------------------
-- 12. DEVOLUCIONES — CU40
-- ---------------------------------------------------------------------
CREATE TABLE devoluciones (
    id_devolucion   SERIAL PRIMARY KEY,
    id_venta        INTEGER REFERENCES ventas(id_venta),
    id_usuario      INTEGER REFERENCES usuarios(id_usuario),
    id_sucursal     INTEGER REFERENCES sucursales(id_sucursal),
    motivo          VARCHAR(255),
    estado          VARCHAR(20) DEFAULT 'En trámite',
    fecha_creacion  TIMESTAMP DEFAULT NOW(),
    fecha_procesada TIMESTAMP
);

CREATE TABLE devolucion_items (
    id_devolucion_item SERIAL PRIMARY KEY,
    id_devolucion      INTEGER REFERENCES devoluciones(id_devolucion) ON DELETE CASCADE,
    id_ptc             INTEGER REFERENCES producto_talla_color(id_ptc),
    cantidad           INTEGER,
    tipo               VARCHAR(20)
);

-- ---------------------------------------------------------------------
-- 9. VESTIDOR VIRTUAL RA — CU32
-- ---------------------------------------------------------------------
CREATE TABLE sesiones_ra (
    id_sesion_ra   SERIAL PRIMARY KEY,
    id_usuario     INTEGER REFERENCES usuarios(id_usuario),
    id_ptc         INTEGER REFERENCES producto_talla_color(id_ptc),
    medidas_avatar VARCHAR(120),
    fecha          TIMESTAMP DEFAULT NOW(),
    id_reserva     INTEGER REFERENCES reservas(id_reserva),
    id_carrito     INTEGER REFERENCES carritos(id_carrito)
);

CREATE TABLE resultados_prueba (
    id_resultado SERIAL PRIMARY KEY,
    id_sesion_ra INTEGER REFERENCES sesiones_ra(id_sesion_ra),
    id_ptc       INTEGER REFERENCES producto_talla_color(id_ptc),
    resultado    VARCHAR(20),
    fecha        TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 13. IA — CU41-CU43
-- ---------------------------------------------------------------------
CREATE TABLE preferencias_cliente (
    id_preferencia SERIAL PRIMARY KEY,
    id_cliente     INTEGER REFERENCES clientes(id_cliente),
    id_categoria   INTEGER REFERENCES categorias(id_categoria),
    id_talla       INTEGER REFERENCES tallas(id_talla),
    id_color       INTEGER REFERENCES colores(id_color),
    id_temporada   INTEGER REFERENCES temporadas(id_temporada),
    puntaje        INTEGER
);

CREATE TABLE historial_navegacion (
    id_historial SERIAL PRIMARY KEY,
    id_usuario   INTEGER REFERENCES usuarios(id_usuario),
    id_ptc       INTEGER REFERENCES producto_talla_color(id_ptc),
    fecha        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE recomendaciones_ia (
    id_recomendacion SERIAL PRIMARY KEY,
    id_usuario       INTEGER REFERENCES usuarios(id_usuario),
    id_ptc           INTEGER REFERENCES producto_talla_color(id_ptc),
    justificacion    TEXT,
    fecha            TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conversaciones_ia (
    id_conversacion SERIAL PRIMARY KEY,
    id_usuario      INTEGER REFERENCES usuarios(id_usuario),
    mensaje         TEXT,
    respuesta       TEXT,
    fecha           TIMESTAMP DEFAULT NOW()
);

CREATE TABLE reportes_generativos (
    id_reporte  SERIAL PRIMARY KEY,
    id_usuario  INTEGER REFERENCES usuarios(id_usuario),
    tipo        VARCHAR(40),
    parametros  JSONB,
    formato     VARCHAR(10),
    url_archivo TEXT,
    fecha       TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 14. RESPALDOS — CU27
-- ---------------------------------------------------------------------
CREATE TABLE respaldos (
    id_respaldo  SERIAL PRIMARY KEY,
    fecha        TIMESTAMP DEFAULT NOW(),
    tipo         VARCHAR(20),
    tamano_bytes BIGINT,
    estado       VARCHAR(20) DEFAULT 'En Progreso',
    storage_url  TEXT,
    creado_por   INTEGER REFERENCES usuarios(id_usuario)
);

-- =====================================================================
-- ÍNDICES
-- =====================================================================
CREATE INDEX idx_bitacora_fecha ON bitacora_auditoria (fecha_hora DESC);
CREATE INDEX idx_bitacora_tabla ON bitacora_auditoria (tabla_afectada);
CREATE INDEX idx_mov_inv_ptc_suc ON movimientos_inventario (id_ptc, id_sucursal, fecha);
CREATE INDEX idx_inventario_sucursal ON inventario_stock (id_sucursal);
CREATE INDEX idx_ventas_sucursal_fecha ON ventas (id_sucursal, fecha_venta);
CREATE INDEX idx_reservas_cliente ON reservas (id_usuario);
CREATE INDEX idx_ordenes_proveedor ON ordenes_compra (id_proveedor, estado);

-- =====================================================================
-- DATOS INICIALES
-- =====================================================================

-- Roles base (RBAC)
INSERT INTO roles (nombre_rol, descripcion, permisos_json, estado) VALUES
    ('Administrador', 'Acceso total al sistema', '["*"]', 'Activo'),
    ('Encargado de Sucursal', 'Gestiona operaciones de su sucursal', '["gestionar_catalogo","ver_inventario","editar_inventario","gestionar_compras","gestionar_recepciones","gestionar_reservas","ver_existencias"]', 'Activo'),
    ('Cajero', 'Procesa ventas y pagos en caja', '["procesar_pagos","ver_inventario","registrar_venta","gestionar_devoluciones"]', 'Activo'),
    ('Cliente', 'Compra y reserva en la plataforma', '["ver_catalogo","comprar","reservar","usar_vestidor_ra"]', 'Activo'),
    ('Proveedor', 'Consulta órdenes de compra', '["ver_ordenes_compra"]', 'Activo');

-- Tallas estándar (XS-XXL)
INSERT INTO tallas (nombre, orden) VALUES
    ('XS', 1), ('S', 2), ('M', 3), ('L', 4), ('XL', 5), ('XXL', 6);

-- Colores base
INSERT INTO colores (nombre, codigo_hex) VALUES
    ('Negro', '#000000'), ('Blanco', '#FFFFFF'), ('Rojo', '#FF0000'),
    ('Azul', '#0000FF'), ('Verde', '#00FF00'), ('Gris', '#808080'),
    ('Beige', '#F5F5DC'), ('Rosa', '#FFC0CB');

-- Categorías de prendas
INSERT INTO categorias (nombre, descripcion) VALUES
    ('Remera', 'Prendas de algodón manga corta'),
    ('Pantalón', 'Pantalones de vestir y casual'),
    ('Vestido', 'Vestidos para mujer'),
    ('Zapato', 'Calzado de todo tipo'),
    ('Accesorio', 'Complementos y accesorios'),
    ('Abrigo', 'Chaquetas, camperas y abrigos'),
    ('Polo', 'Remeras con cuello'),
    ('Pijama', 'Ropa de dormir');

-- =====================================================================
-- TRIGGERS Y PROCEDIMIENTOS ALMACENADOS
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TRIGGER: Bloqueo por intentos fallidos (CU01)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_incrementar_intentos()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.intentos_fallidos >= 5 THEN
        NEW.estado = 'Bloqueado';
        NEW.bloqueado_hasta = NOW() + INTERVAL '15 minutes';
        NEW.intentos_fallidos = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bloquear_usuario_5_intentos
BEFORE UPDATE OF intentos_fallidos ON usuarios
FOR EACH ROW
EXECUTE FUNCTION fn_incrementar_intentos();

-- ---------------------------------------------------------------------
-- 2. TRIGGER: Recalcular stock en movimiento de inventario
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_aplicar_movimiento_inventario()
RETURNS TRIGGER AS $$
DECLARE
    v_disponible INTEGER;
BEGIN
    SELECT cantidad_disponible INTO v_disponible
    FROM inventario_stock
    WHERE id_ptc = NEW.id_ptc AND id_sucursal = NEW.id_sucursal;

    IF v_disponible IS NULL THEN
        v_disponible := 0;
    END IF;

    NEW.stock_anterior := v_disponible;
    NEW.stock_posterior := v_disponible + NEW.cantidad;
    NEW.fecha := NOW();

    INSERT INTO inventario_stock (id_ptc, id_sucursal, cantidad_disponible)
    VALUES (NEW.id_ptc, NEW.id_sucursal, NEW.cantidad)
    ON CONFLICT (id_ptc, id_sucursal)
    DO UPDATE SET cantidad_disponible = inventario_stock.cantidad_disponible + NEW.cantidad;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movimiento_inventario
BEFORE INSERT ON movimientos_inventario
FOR EACH ROW
EXECUTE FUNCTION fn_aplicar_movimiento_inventario();

-- ---------------------------------------------------------------------
-- 3. PROCEDIMIENTO: Registrar venta (CU36-CU39)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_registrar_venta(
    p_id_usuario   INTEGER,
    p_id_sucursal  INTEGER,
    p_modalidad    VARCHAR,
    p_metodo_pago  VARCHAR,
    p_items        JSONB,
    OUT p_venta_id INTEGER,
    OUT p_total    DECIMAL(12,2)
) AS $$
DECLARE
    item JSONB;
    v_id_ptc INTEGER;
    v_cant INTEGER;
    v_precio DECIMAL(10,2);
    v_stock INTEGER;
    v_subtotal DECIMAL(12,2);
BEGIN
    p_total := 0;

    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_id_ptc := (item->>'id_ptc')::INTEGER;
        v_cant := (item->>'cantidad')::INTEGER;
        v_precio := (item->>'precio_unitario')::DECIMAL(10,2);

        SELECT cantidad_disponible - cantidad_reservada INTO v_stock
        FROM inventario_stock
        WHERE id_ptc = v_id_ptc AND id_sucursal = p_id_sucursal
        FOR UPDATE;

        IF v_stock IS NULL OR v_stock < v_cant THEN
            RAISE EXCEPTION 'Stock insuficiente para producto % (disponible %)', v_id_ptc, v_stock;
        END IF;

        v_subtotal := v_cant * v_precio;
        p_total := p_total + v_subtotal;
    END LOOP;

    INSERT INTO ventas (id_usuario, id_sucursal, modalidad, metodo_pago, subtotal, impuestos, total, estado)
    VALUES (p_id_usuario, p_id_sucursal, p_modalidad, p_metodo_pago, p_total, 0, p_total, 'Completada')
    RETURNING id_venta INTO p_venta_id;

    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_id_ptc := (item->>'id_ptc')::INTEGER;
        v_cant := (item->>'cantidad')::INTEGER;
        v_precio := (item->>'precio_unitario')::DECIMAL(10,2);
        v_subtotal := v_cant * v_precio;

        INSERT INTO venta_items (id_venta, id_ptc, cantidad, precio_unitario, subtotal)
        VALUES (p_venta_id, v_id_ptc, v_cant, v_precio, v_subtotal);

        INSERT INTO movimientos_inventario
            (id_ptc, id_sucursal, tipo_movimiento, cantidad, referencia, id_venta)
        VALUES (v_id_ptc, p_id_sucursal, 'Venta', -v_cant, 'Venta #' || p_venta_id, p_venta_id);
    END LOOP;

    INSERT INTO comprobantes (id_venta, numero, tipo, total)
    VALUES (p_venta_id, 'C-' || LPAD(p_venta_id::TEXT, 8, '0'), 'Factura', p_total);

END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 4. PROCEDIMIENTO: Registrar reserva (CU28)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_registrar_reserva(
    p_id_usuario  INTEGER,
    p_id_sucursal INTEGER,
    p_fecha_ini   DATE,
    p_hora_ini    TIME,
    p_items       JSONB,
    OUT p_reserva_id INTEGER
) AS $$
DECLARE
    item JSONB;
    v_id_ptc INTEGER;
    v_cant INTEGER;
    v_stock_libre INTEGER;
BEGIN
    INSERT INTO reservas (id_usuario, id_sucursal, fecha_reserva, hora_reserva, estado)
    VALUES (p_id_usuario, p_id_sucursal, p_fecha_ini, p_hora_ini, 'Solicitada')
    RETURNING id_reserva INTO p_reserva_id;

    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_id_ptc := (item->>'id_ptc')::INTEGER;
        v_cant := (item->>'cantidad')::INTEGER;

        SELECT cantidad_disponible - cantidad_reservada INTO v_stock_libre
        FROM inventario_stock WHERE id_ptc = v_id_ptc AND id_sucursal = p_id_sucursal FOR UPDATE;

        IF v_stock_libre IS NULL OR v_stock_libre < v_cant THEN
            RAISE EXCEPTION 'No hay stock libre suficiente (producto %)', v_id_ptc;
        END IF;

        INSERT INTO reserva_items (id_reserva, id_ptc, cantidad)
        VALUES (p_reserva_id, v_id_ptc, v_cant);

        UPDATE inventario_stock SET cantidad_reservada = cantidad_reservada + v_cant
        WHERE id_ptc = v_id_ptc AND id_sucursal = p_id_sucursal;

        INSERT INTO movimientos_inventario
            (id_ptc, id_sucursal, tipo_movimiento, cantidad, referencia, id_reserva)
        VALUES (v_id_ptc, p_id_sucursal, 'Reserva', -v_cant, 'Reserva #' || p_reserva_id, p_reserva_id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 5. PROCEDIMIENTO: Registrar devolución (CU40)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_registrar_devolucion(
    p_id_venta     INTEGER,
    p_id_usuario   INTEGER,
    p_id_sucursal  INTEGER,
    p_motivo       VARCHAR,
    p_items        JSONB,
    OUT p_devolucion_id INTEGER
) AS $$
DECLARE
    item JSONB;
    v_id_ptc INTEGER;
    v_cant INTEGER;
    v_tipo VARCHAR;
BEGIN
    INSERT INTO devoluciones (id_venta, id_usuario, id_sucursal, motivo, estado)
    VALUES (p_id_venta, p_id_usuario, p_id_sucursal, p_motivo, 'Procesada')
    RETURNING id_devolucion INTO p_devolucion_id;

    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_id_ptc := (item->>'id_ptc')::INTEGER;
        v_cant := (item->>'cantidad')::INTEGER;
        v_tipo := (item->>'tipo')::VARCHAR;

        INSERT INTO devolucion_items (id_devolucion, id_ptc, cantidad, tipo)
        VALUES (p_devolucion_id, v_id_ptc, v_cant, v_tipo);

        INSERT INTO movimientos_inventario
            (id_ptc, id_sucursal, tipo_movimiento, cantidad, referencia, id_venta)
        VALUES (v_id_ptc, p_id_sucursal, 'Devolución', v_cant, 'Devolución #' || p_devolucion_id, p_id_venta);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 6. PROCEDIMIENTO: Recepción de mercadería (CU22)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_registrar_recepcion(
    p_id_orden     INTEGER,
    p_id_usuario   INTEGER,
    p_id_sucursal  INTEGER,
    p_items        JSONB,
    OUT p_recepcion_id INTEGER
) AS $$
DECLARE
    item JSONB;
    v_id_ptc INTEGER;
    v_recibida INTEGER;
BEGIN
    INSERT INTO recepciones (id_orden_compra, id_sucursal, id_usuario, estado)
    VALUES (p_id_orden, p_id_sucursal, p_id_usuario, 'Registrada')
    RETURNING id_recepcion INTO p_recepcion_id;

    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_id_ptc := (item->>'id_ptc')::INTEGER;
        v_recibida := (item->>'cantidad_recibida')::INTEGER;

        INSERT INTO recepcion_items (id_recepcion, id_ptc, cantidad_recibida, diferencia)
        VALUES (p_recepcion_id, v_id_ptc, v_recibida, 0);

        INSERT INTO movimientos_inventario
            (id_ptc, id_sucursal, tipo_movimiento, cantidad, referencia, id_orden_compra)
        VALUES (v_id_ptc, p_id_sucursal, 'Recepción', v_recibida, 'Orden #' || p_id_orden, p_id_orden);
    END LOOP;

    UPDATE ordenes_compra SET estado = 'Recibida', fecha_recepcion = NOW()
    WHERE id_orden_compra = p_id_orden;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 7. FUNCIÓN: Detectar stock bajo (CU25/CU26)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_detectar_stock_bajo()
RETURNS TABLE(
    id_ptc INTEGER, id_sucursal INTEGER, producto VARCHAR, talla VARCHAR,
    color VARCHAR, stock_actual INTEGER, stock_minimo INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT a.id_ptc, is2.id_sucursal,
           p.nombre, t.nombre, c.nombre,
           is2.cantidad_disponible, a.stock_minimo
    FROM alertas_stock_config a
    JOIN inventario_stock is2 ON is2.id_ptc = a.id_ptc AND is2.id_sucursal = a.id_sucursal
    JOIN producto_talla_color ptc ON ptc.id_ptc = a.id_ptc
    JOIN productos p ON p.id_producto = ptc.id_producto
    JOIN tallas t ON t.id_talla = ptc.id_talla
    JOIN colores c ON c.id_color = ptc.id_color
    WHERE a.notificar_email = true
      AND is2.cantidad_disponible <= a.stock_minimo
      AND (a.ultima_notificacion IS NULL OR a.ultima_notificacion < NOW() - INTERVAL '24 hours');
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 8. FUNCIÓN: Kardex con saldos (CU23)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_kardex_producto(
    p_id_ptc INTEGER, p_id_sucursal INTEGER
) RETURNS TABLE(
    fecha TIMESTAMP, tipo VARCHAR, cantidad INTEGER,
    stock_anterior INTEGER, stock_posterior INTEGER, referencia VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT m.fecha, m.tipo_movimiento, m.cantidad,
           m.stock_anterior, m.stock_posterior, m.referencia
    FROM movimientos_inventario m
    WHERE m.id_ptc = p_id_ptc AND m.id_sucursal = p_id_sucursal
    ORDER BY m.fecha ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- FIN DEL SCRIPT
-- =====================================================================
