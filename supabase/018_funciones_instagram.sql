-- La cuenta de Instagram del grupo de cada función, sin «@». Con ella el botón
-- abre el perfil (instagram.com/<cuenta>/, que el celular abre en la app); sin
-- ella la app cae a una búsqueda.
--
-- Solo cuentas confirmadas (perfil existente, nombre del grupo), 6 nov 2026:
-- Delirium Teatro desde su web; el resto abriendo el perfil. Los encuentros
-- académicos van a Comfama Cultura, que los organiza.

alter table eventos.funciones add column if not exists instagram text;

update eventos.funciones f set instagram = v.cuenta
  from eventos.festivales fe,
       (values
         ('compania', 'Delirium Teatro%',          'deliriumteatro'),
         ('compania', 'Grupo Galpão%',             'grupogalpao'),
         ('compania', 'La Libélula Dorada%',       'teatrolibeluladorada'),
         ('compania', 'Átomos Teatro%',            'atomosteatro'),
         ('compania', 'ID Studio Theater%',        'idstudiotheater'),
         ('obra',     'Conversatorio%',            'comfamacultura'),
         ('obra',     'Escuela de espectadores%',  'comfamacultura'),
         ('obra',     'Taller%',                   'comfamacultura')
       ) as v(campo, patron, cuenta)
 where fe.id = f.festival_id
   and fe.slug = 'festival-teatro-san-ignacio-2026'
   and f.instagram is null
   and (case v.campo when 'compania' then f.compania else f.obra end) ilike v.patron;

notify pgrst, 'reload schema';
