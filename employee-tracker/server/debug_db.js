const db = require('./database');

console.log('Testing clockIn...');

// Wait for DB connection (database.js connects immediately but async)
setTimeout(() => {
    // Get an employee ID first
    db.getAllEmployees((err, employees) => {
        if (err) {
            console.error('Error getting employees:', err);
            return;
        }
        if (employees.length === 0) {
            console.log('No employees found to test.');
            return;
        }

        const empId = employees[0].id;
        console.log('Testing clockIn for employee:', employees[0].name, '(ID:', empId, ')');

        db.clockIn(empId, 0, 0, (err, result) => {
            if (err) {
                console.error('ClockIn failed:', err.message);
            } else {
                console.log('ClockIn success:', result);
            }
        });
    });
}, 1000);
