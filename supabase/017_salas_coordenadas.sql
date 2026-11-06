-- Coordenadas de cada sala, para pedir Uber con el destino ya puesto: su enlace
-- universal necesita latitud y longitud (la dirección sola es de adorno).
--
-- Fuente: OpenStreetMap (Nominatim y Overpass), 6 nov 2026. Las que OSM no
-- tiene salen del cruce de calles de su dirección o del edificio que las
-- contiene. Sin coordenada, la app no muestra el botón de Uber.

alter table eventos.salas add column if not exists lat double precision;
alter table eventos.salas add column if not exists lng double precision;

update eventos.salas s set lat = v.lat, lng = v.lng
  from (values
    ('fsi-ptu',            6.2474702, -75.5591005),  -- OSM: Teatro Pablo Tobón Uribe
    ('fsi-matacandelas',   6.2445086, -75.5645847),  -- OSM: Teatro Matacandelas
    ('fsi-pequeno',        6.2474759, -75.5616526),  -- OSM: Pequeño Teatro
    ('fsi-tpm',            6.2445400, -75.5621550),  -- Calle 48 × Carrera 41 (Clle. 48 #41-13)
    ('fsi-casa-clown',     6.2424000, -75.5640000),  -- Carrera 42 × Calle 44, unos 40 m al norte (Cra. 42 #44-46)
    ('fsi-claustro-sala',  6.2457531, -75.5637191),  -- OSM: Comfama Claustro San Ignacio
    ('fsi-capilla',        6.2457531, -75.5637191),  -- dentro del Claustro
    ('fsi-patio',          6.2457531, -75.5637191),  -- dentro del Claustro
    ('fsi-comfama',        6.2457531, -75.5637191),  -- Clle. 48 #43-87, la cuadra del Claustro
    ('fsi-pascasia',       6.2445086, -75.5645847),  -- Calle 47 cerca de Matacandelas; OSM no la tiene
    ('fsi-plazuela',       6.2462027, -75.5645148),  -- OSM: Plazuela San Ignacio
    ('fsi-san-antonio',    6.2471899, -75.5697493),  -- OSM: Estación San Antonio, línea A
    ('fsi-udea-camilo',    6.2678611, -75.5692776)   -- OSM: Teatro Universitario Camilo Torres
  ) as v(slug, lat, lng)
 where s.slug = v.slug and s.lat is null;

notify pgrst, 'reload schema';
