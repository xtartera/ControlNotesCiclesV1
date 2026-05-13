const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'avaluacio.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.get("SELECT * FROM moduls WHERE codi = ?", ['MP01'], (err, row) => {
        if (err) {
            console.error(err.message);
            process.exit(1);
        }
        if (row) {
            console.log(`Module found: ID=${row.id}, Code=${row.codi}, Name=${row.nom}`);
            db.run("DELETE FROM moduls WHERE id = ?", [row.id], function(err) {
                if (err) {
                    console.error(err.message);
                    process.exit(1);
                }
                console.log(`Deleted module and associated data. Rows affected: ${this.changes}`);
                db.close();
            });
        } else {
            console.log("Module MP01 not found.");
            db.close();
        }
    });
});
