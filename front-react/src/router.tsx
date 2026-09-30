import { type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/admin/AdminLayout.js';
import { ClienteLayout } from '@/components/layout/cliente/ClienteLayout.js';
import { Home } from '@/pages/Home.js';
import { Catalogo } from '@/pages/Catalogo.js';
import { Producto } from '@/pages/Producto.js';
import { Login } from '@/pages/Login.js';
import { Registro } from '@/pages/Registro.js';
import { RecuperarContrasena } from '@/pages/RecuperarContrasena.js';
import { RestablecerContrasena } from '@/pages/RestablecerContrasena.js';
import { EstablecerContrasena } from '@/pages/EstablecerContrasena.js';
import { Auditoria } from '@/pages/admin/Auditoria.js';
import { ReportesVoz } from '@/pages/admin/ReportesVoz.js';
import { Usuarios } from '@/pages/admin/Usuarios.js';
import { Roles } from '@/pages/admin/Roles.js';
import { Sucursales } from '@/pages/admin/Sucursales.js';
import { AdminCatalogoProductos } from '@/pages/admin/AdminCatalogoProductos.js';
import { AdminCatalogos } from '@/pages/admin/AdminCatalogos.js';
import { AdminTemporadas } from '@/pages/admin/AdminTemporadas.js';
import { AdminProveedores } from '@/pages/admin/AdminProveedores.js';
import { AdminOrdenesCompra } from '@/pages/admin/AdminOrdenesCompra.js';
import { AdminKardex } from '@/pages/admin/AdminKardex.js';
import { AdminAjustes } from '@/pages/admin/AdminAjustes.js';
import { AdminAlertas } from '@/pages/admin/AdminAlertas.js';
import { AdminAlertasCriticas } from '@/pages/admin/AdminAlertasCriticas.js';
import { AdminDashboard } from '@/pages/admin/AdminDashboard.js';
import { AdminExistencias } from '@/pages/admin/AdminExistencias.js';
import { AdminRespaldos } from '@/pages/admin/AdminRespaldos.js';
import { AdminReservas } from '@/pages/admin/AdminReservas.js';
import { AdminCaja } from '@/pages/admin/AdminCaja.js';
import { AdminPlaceholder } from '@/pages/admin/AdminPlaceholder.js';
import { MisReservas } from '@/pages/cliente/MisReservas.js';
import { MisPruebasRa } from '@/pages/cliente/MisPruebasRa.js';
import { DetalleReserva } from '@/pages/cliente/DetalleReserva.js';
import { MisCompras } from '@/pages/cliente/MisCompras.js';
import { MiCuenta } from '@/pages/cliente/MiCuenta.js';
import { ComprobarFotos } from '@/pages/ComprobarFotos.js';
import { Recomendaciones } from '@/pages/cliente/Recomendaciones.js';
import { Checkout } from '@/pages/Checkout.js';
import { SandboxPago } from '@/pages/SandboxPago.js';
import { EnConstruccion } from '@/pages/EnConstruccion.js';

function Placeholder({ titulo }: { titulo: string }): ReactNode {
  return <EnConstruccion titulo={titulo} />;
}

export function RouterApp() {
  return (
    <Routes>
      {/* Toda la tienda usa ClienteLayout, que lleva la barra, el pie y el
          panel del carrito. Antes estas rutas usaban LayoutRaiz con el
          Navbar viejo, y ahi seguia vivo el desplegable de "Mi cuenta" con
          la flechita: por eso el cliente seguia viendolo en la portada. */}
      <Route element={<ClienteLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/productos" element={<Navigate to="/catalogo" replace />} />
        <Route path="/productos/:codigo" element={<Producto />} />
        {/* El carrito es un panel lateral, no una pagina. Si alguien escribe
            /carrito en la barra, tiene que llegar a la tienda, no a un
            marcador de posicion vacio. */}
        <Route path="/carrito" element={<Navigate to="/productos" replace />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/sandbox-pago" element={<SandboxPago />} />
        <Route path="/reservas/nueva" element={<Navigate to="/catalogo" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/recuperar-contraseña" element={<RecuperarContrasena />} />
        <Route path="/restablecer-contraseña" element={<RestablecerContrasena />} />
        <Route path="/establecer-contraseña" element={<EstablecerContrasena />} />
        {/* Esta pagina comprueba que las fotos existan de verdad. No es parte
            de la tienda: es la herramienta para cuando se cambian las fotos
            y hay que saber si alguna se quedo sin cargar. */}
        <Route path="comprobar-fotos" element={<ComprobarFotos />} />
        <Route path="*" element={<Placeholder titulo="Página no encontrada" />} />
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        {/* El indice es el dashboard, no la lista de usuarios: es la pantalla
            que el administrador ve al entrar y la que resume el negocio. */}
        <Route index element={<AdminDashboard />} />
        <Route path="usuarios" element={<Usuarios />} />
        <Route path="roles" element={<Roles />} />
        <Route path="sucursales" element={<Sucursales />} />
        <Route path="catalogo/productos" element={<AdminCatalogoProductos />} />
        <Route path="catalogo/listas" element={<AdminCatalogos />} />
        <Route path="temporadas" element={<AdminTemporadas />} />
        <Route path="proveedores" element={<AdminProveedores />} />
        <Route path="ordenes-compra" element={<AdminOrdenesCompra />} />
        <Route path="inventario/kardex" element={<AdminKardex />} />
        <Route path="inventario/ajustes" element={<AdminAjustes />} />
        <Route path="inventario/alertas" element={<AdminAlertas />} />
        <Route path="inventario/existencias" element={<AdminExistencias />} />
        <Route path="inventario/backup" element={<AdminRespaldos />} />
        <Route path="alertas/criticas" element={<AdminAlertasCriticas />} />
        <Route path="reservas" element={<AdminReservas />} />
        <Route path="caja" element={<AdminCaja />} />
        <Route path="auditoria" element={<Auditoria />} />
        <Route path="reportes/voz" element={<ReportesVoz />} />
        <Route path="*" element={<AdminPlaceholder />} />
      </Route>

      <Route path="/mi-cuenta" element={<ClienteLayout />}>
        <Route index element={<MiCuenta />} />
      </Route>

      <Route path="/reservas" element={<ClienteLayout />}>
        <Route index element={<MisReservas />} />
        <Route path=":id" element={<DetalleReserva />} />
        <Route path="pruebas-ra" element={<MisPruebasRa />} />
      </Route>

      <Route path="/compras" element={<ClienteLayout />}>
        <Route index element={<MisCompras />} />
      </Route>

      <Route path="/recomendaciones" element={<ClienteLayout />}>
        <Route index element={<Recomendaciones />} />
      </Route>
    </Routes>
  );
}