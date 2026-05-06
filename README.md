# EvalApp v12 - Control de Notes Alumnes (Premium)

Aplicació web professional per a la gestió d'avaluacions basada en RA (Resultats d'Aprenentatge) i CA (Criteris d'Avaluació), dissenyada per a docents que necessiten un control precís i visual de les notes de l'alumnat.

## 🚀 Desplegament a Render

Aquesta aplicació està optimitzada per funcionar a **Render** amb una arquitectura de servidor Node.js i base de dades PostgreSQL.

1. **Base de Dades:** Crea una instància de PostgreSQL a Render.
2. **Web Service:** Crea un Web Service connectat al repositori de GitHub.
3. **Variables d'Entorn:** Afegeix `DATABASE_URL` vinculant la base de dades creada. El servidor s'encarregarà d'inicialitzar les taules automàticament.

---

## 💻 Desenvolupament Local (Connectat a Render)

Pots executar l'aplicació al teu ordinador (`localhost:3000`) i que les dades es guardin directament a la base de dades de Render. Això permet treballar simultàniament des de qualsevol lloc.

### 1. Obtenir la URL Externa
Dins del panell de la teva base de dades a Render, busca el camp **"External Database URL"**. Tindrà un aspecte similar a:
`postgresql://user:password@frankfurt-postgres.render.com/dbname`

### 2. Executar el servidor en local
Obre una terminal (PowerShell a Windows) a la carpeta del projecte i executa les següents comandes:

```powershell
# 1. Configurar la connexió (només cal fer-ho un cop per sessió de terminal)
$env:DATABASE_URL="LA_TEVA_URL_EXTERNA_AQUÍ"

# 2. Instal·lar dependències (si és la primera vegada)
npm install

# 3. Arrencar l'aplicació
npm start
```

Un cop engegat, podràs entrar a: **http://localhost:3000**

---

## 🛠️ Tecnologies Utilitzades

- **Backend:** Node.js + Express
- **Frontend:** HTML5, CSS3 (Vanilla), JavaScript (ES6+)
- **Base de dades:** PostgreSQL
- **Icones:** Lucide Icons
- **Tipografia:** Outfit (Google Fonts)

## 📁 Estructura del Projecte

- `/public`: Fitxers estàtics (HTML, CSS, JS del client).
- `/sql`: Esquema de la base de dades (`schema.sql`).
- `server.js`: Servidor Express i connexió a la DB.
- `package.json`: Dependències i scripts d'arrencada.

---
*Creat amb ❤️ per al control educatiu professional.*
