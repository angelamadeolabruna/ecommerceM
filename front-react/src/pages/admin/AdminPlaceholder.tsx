import { useLocation } from 'react-router-dom';
import { PAQUETES_ADMIN } from '@/data/adminMenu.js';
import { EnConstruccion } from '@/pages/EnConstruccion.js';

export function AdminPlaceholder() {
  const { pathname } = useLocation();

  let etiqueta = 'Módulo de administración';
  for (const paquete of PAQUETES_ADMIN) {
    const item = paquete.items.find((i) => i.ruta === pathname);
    if (item) {
      etiqueta = item.etiqueta;
      break;
    }
  }

  return (
    <EnConstruccion
      titulo={etiqueta}
      volverA="/admin/auditoria"
      volverEtiqueta="Ir a la bitácora de auditoría"
    />
  );
}