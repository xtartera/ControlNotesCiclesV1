const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'avaluacio.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("--- PROJECTE_RA CONTENT ---");
    db.all("SELECT * FROM projecte_ra", (err, rows) => {
        if (err) console.error(err);
        else console.log(JSON.stringify(rows, null, 2));
    });
    console.log("--- RAS CONTENT ---");
    db.all("SELECT id, codi, modul_id FROM ras", (err, rows) => {
        if (err) console.error(err);
        else console.log(JSON.stringify(rows, null, 2));
        db.close();
    });
});
