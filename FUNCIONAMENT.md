# Avaluació RA/CA local v11

Aquesta versió és una aplicació local amb **Node.js + Express + SQLite** per gestionar alumnes, mòduls, RA, CA, projectes, ponderacions, notes i resultats.

## Execució local

```bash
npm install
npm start
```

Després obre:

```text
http://localhost:3000
```

La base de dades es crea automàticament al fitxer:

```text
avaluacio.db
```

## Pantalles principals

### Currículum
Permet importar un CSV amb el mòdul, els RA i els CA. També mostra el mòdul de manera visual: cada RA apareix com una targeta i conté els seus CA.

CSV esperat:

```text
modul_codi,modul_nom,modul_hores,modul_curs,ra_codi,ra_descripcio,ra_pes,ra_nota_minima,ca_codi,ca_descripcio,ca_pes
```

Hi ha un exemple a:

```text
samples/mp04_curriculum.csv
```

### Tipus d’activitat
Permet crear i configurar tipus com:

- Projecte didàctic
- Quadern digital
- Síntesi teòrica
- Síntesi pràctica
- Altres tipus afegits pel docent

Camps destacats:

- `pes_defecte`: valor orientatiu.
- `requereix_minim`: indica si l’activitat té una nota mínima obligatòria.
- `nota_minima`: normalment 5.
- `limita_ra`: si està activat i l’alumne no arriba al mínim, el RA associat queda suspès.
- `actiu`: permet retirar un tipus sense esborrar-lo.

### Projectes
Permet crear totes les activitats del curs des de l’inici. Cada projecte o activitat queda associat a un mòdul i a un tipus d’activitat.

Les activitats futures poden existir des del primer dia. El càlcul de notes només té en compte les activitats que tenen nota introduïda.

### Ponderacions
Permet vincular un projecte amb RA i CA.

Regles de ponderació:

- La suma dels RA d’un projecte no pot superar el 100%.
- Els CA seleccionats dins d’un RA no poden superar el topall assignat a aquell RA.
- El repartiment automàtic es pot activar o desactivar.
- En mode manual, l’usuari pot introduir pesos propis i l’aplicació només valida abans de gravar.

### Grups i alumnes
Permet crear grups, crear alumnes i importar alumnes via CSV.

CSV esperat:

```text
numero,grup_classe,nom,cognoms,data_naixement
```

Hi ha un exemple a:

```text
samples/alumnes.csv
```

### Notes
La pantalla de notes és una matriu horitzontal:

```text
Alumne | Projecte 1 | Projecte 2 | Projecte 3 | ...
```

- Files: alumnes.
- Columnes: projectes o activitats.
- Les notes es poden escriure directament a la cel·la.
- Una cel·la buida significa que l’activitat encara no s’ha avaluat.
- Les activitats sense nota no participen en el recàlcul.

### Resultats
Mostra una matriu:

```text
Alumne | RA1 | RA2 | RA3 | Nota final orientativa
```

Els valors es generen en prémer **Recalcular notes RA**.

## Lògica de càlcul

Per cada alumne i RA:

1. Es busquen els projectes associats al RA.
2. Només s’agafen els projectes que tenen nota introduïda.
3. Es calcula la mitjana ponderada segons `projecte_ra.pes`.
4. Si una activitat marcada com a mínim obligatori i limitadora té una nota inferior a la mínima, s’aplica la regla de bloqueig.

Regla de bloqueig:

```text
Si una activitat de síntesi o tipus equivalent està suspesa:
  - si la mitjana del RA és >= 5, la nota final del RA queda limitada a 4
  - si la mitjana del RA és < 5, es conserva aquesta mitjana suspesa
```

## Taules principals

- `grups`
- `alumnes`
- `moduls`
- `ras`
- `cas`
- `tipus_activitat`
- `projectes`
- `projecte_ra`
- `projecte_ca`
- `notes_projecte`
- `notes_ra_calculades`

## Recomanació de treball

1. Importa el currículum del mòdul.
2. Revisa RA i CA a la pantalla Currículum.
3. Configura els tipus d’activitat.
4. Crea tots els projectes i activitats del curs.
5. Defineix ponderacions per projecte.
6. Importa alumnes.
7. Introdueix notes a la matriu.
8. Recalcula resultats.

## Notes tècniques

Aquesta versió és pensada per treballar localment. Quan el model i la UI estiguin estabilitzats, es pot migrar a Vercel + Supabase canviant SQLite per PostgreSQL i traslladant els endpoints a API serverless.
