'use client';
import { useState } from 'react';
import { aTSV, aHTML } from '../lib/exportar.mjs';

// Botón de copiar a Excel. La cadena de respaldos viene de la skill
// festival-agenda, donde ya está probada: el portapapeles falla distinto en
// cada navegador y en Safari de iOS falla sin avisar. Los tres niveles son:
//
//   1. clipboard.write con text/html y text/plain: pega la tabla ya formada.
//   2. clipboard.writeText con el TSV: pega en columnas, sin formato.
//   3. execCommand sobre un textarea escondido: navegadores viejos.
//
// Si los tres fallan se selecciona la tabla en pantalla y se le pide un Ctrl+C.
// Quedarse callado sería peor: creería que copió y pegaría lo anterior.

function porExecCommand(texto) {
  const ta = document.createElement('textarea');
  ta.value = texto;
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta);
  ta.focus(); ta.select(); ta.setSelectionRange(0, texto.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  document.body.removeChild(ta);
  return ok;
}

function seleccionarParaCopiaManual(html) {
  let caja = document.getElementById('copia-manual');
  if (!caja) {
    caja = document.createElement('div');
    caja.id = 'copia-manual';
    caja.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(caja);
  }
  caja.innerHTML = html;
  const rango = document.createRange();
  rango.selectNodeContents(caja);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(rango);
}

export default function Exportar({ cols, filas, que = 'la tabla' }) {
  const [aviso, setAviso] = useState(null);

  async function copiar() {
    if (!filas.length) return setAviso({ ok: false, txt: 'No hay nada que copiar' });

    const tsv = aTSV(cols, filas);
    const html = aHTML(cols, filas);
    const listo = () => setAviso({ ok: true, txt: `Copiado — pega en Excel con Ctrl+V` });

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([tsv], { type: 'text/plain' }),
        })]);
        return listo();
      }
    } catch { /* sigue al siguiente respaldo */ }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(tsv);
        return listo();
      }
    } catch { /* sigue al siguiente respaldo */ }

    if (porExecCommand(tsv)) return listo();

    seleccionarParaCopiaManual(html);
    setAviso({ ok: false, txt: 'No se pudo copiar solo: presiona Ctrl+C ahora' });
  }

  return (
    <p className="exportar">
      <button type="button" className="boton" data-tam="chico" onClick={copiar}>
        Copiar {que} para Excel
      </button>
      {aviso && (
        <span className="exportar-aviso" data-ok={String(aviso.ok)} role="status">
          {aviso.txt}
        </span>
      )}
      <span className="exportar-n num">{filas.length} filas</span>
    </p>
  );
}
