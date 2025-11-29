const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Checking database at:', dbPath);

db.serialize(() => {
    // Check tables
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) console.error('Error listing tables:', err);
        else console.log('Tables:', tables.map(t => t.name));
    });

    // Check time_records columns
    db.all("PRAGMA table_info(time_records)", (err, columns) => {
        if (err) console.error('Error getting time_records info:', err);
        else {
            console.log('time_records columns:', columns.map(c => c.name));
            const hasIsLate = columns.some(c => c.name === 'is_late');
            console.log('Has is_late column:', hasIsLate);
        }
    });

    // Check settings table
    db.all("SELECT * FROM settings", (err, rows) => {
        if (err) console.error('Error getting settings:', err);
        else console.log('Settings:', rows);
    });
});

db.close();
