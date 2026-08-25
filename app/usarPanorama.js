'use client';
import { useEffect, useState, useCallback } from 'react';
import { cargarPanorama, leerCodigo } from '../lib/cliente.mjs';

// Una sola lectura por pantalla. El festival entero cabe en memoria sin
// esfuerzo —son decenas de funciones, no miles— y tenerlo completo es lo que
// permite cruzar repeticiones y choques sin ir y volver a la base.

export function usarPanorama() {
  const [estado, setEstado] = useState({ fase: 'cargando' });

  const recargar = useCallback(async () => {
    const codigo = leerCodigo();
    if (!codigo) { setEstado({ fase: 'sin-codigo' }); return; }
    setEstado(e => (e.fase === 'listo' ? e : { fase: 'cargando' }));
    try {
      const p = await cargarPanorama(codigo);
      if (!p) { setEstado({ fase: 'sin-datos' }); return; }
      setEstado({ fase: 'listo', p });
    } catch (e) {
      setEstado({ fase: 'error', msg: e.message });
    }
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  return { ...estado, recargar };
}
