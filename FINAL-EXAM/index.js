//config required packages
const express = require("express");
const multer = require("multer");
const app = express();
const fs = require('fs');


// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Set the destination directory for uploaded files
        cb(null, 'uploads'); // Replace 'uploads' with your desired directory
    },
    filename: function (req, file, cb) {
        // Set the filename for uploaded files
        cb(null, file.originalname); // You can modify this as needed
    }
});

const upload = multer({ storage: storage });


require('dotenv').config();

// Set up EJS
app.set("view engine", "ejs");

// Start listener
app.listen(process.env.PORT || 3000, () => {
    console.log("Server started (http://localhost:3000/) !");
});

// Add database package and connection string (can remove ssl)
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.FINALDATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 2
});

// Setup routes

app.get("/", (req, res) => {
    //res.send ("Hello world...");
    const sql = "SELECT * FROM PRODUCT ORDER BY PROD_ID";
    pool.query(sql, [], (err, result) => {
        let message = "";
        let model = {};
        if (err) {
            message = `Error - ${err.message}`;
        } else {
            message = "success";
            model = result.rows;
        };
        res.render("index", {
            message: message,
            model: model
        });
    });
});

app.get("/home", (req, res) => {
    //res.send ("Hello world...");
    const sql = "SELECT * FROM evehicle ORDER BY vid";
    pool.query(sql, [], (err, result) => {
        let message = "";
        let model = {};
        if (err) {
            message = `Error - ${err.message}`;
        } else {
            message = "success";
            model = result.rows;
        };
        res.render("index", {
            message: message,
            model: model
        });
    });
});

app.get("/sumofseries", (req, res) => {
    res.render("sumofseries");
});

// Get /import (to import e-vehicles)
app.get('/import', (req, res) => {
    const sql = 'SELECT * FROM evehicle ORDER BY vid';
    pool.query(sql, [], (err, result) => {
        let message = '';
        let model = {};
        if (err) {
            message = `Error - ${err.message}`;
        } else {
            message = 'success';
            model = result.rows;
        }
        res.render('import', {
            message: message,
            model: model,
        });
    });
});

// POST /import (to handle e-vehicle file import)
app.post('/import', upload.single('importFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');

    let totalRecords = 0;
    const insertedRecords = [];
    const errors = [];

    // Function to insert a single e-vehicle record
    const insertEVehicleRecord = (record) => {
        return new Promise((resolve) => {
            // Parse each record according to the file structure (modify as needed)
            const [vid, vin, city, postal_code, model_year, make, model, ev_type, electric_range, base_msrp, purchase_date] = record.split(',');

            // Prepare the SQL query to insert into the evehicle table
            const sql = 'INSERT INTO evehicle (vid, vin, city, postal_code, model_year, make, model, ev_type, electric_range, base_msrp, purchase_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)';
            const values = [vid, vin, city, postal_code, model_year, make, model, ev_type, electric_range, base_msrp, purchase_date];

            // Execute the query to insert the record
            pool.query(sql, values, (err) => {
                if (err) {
                    errors.push({ index: totalRecords, message: err.message });
                } else {
                    insertedRecords.push(totalRecords);
                }
                resolve();
            });
        });
    };

    // Insert e-vehicle records
    for (let index = 0; index < lines.length; index++) {
        const record = lines[index].trim();
        console.log('got record', record);
        if (record) { // Check for non-empty lines
            await insertEVehicleRecord(record);
            totalRecords++;
        }
    }

    const notInserted = totalRecords - insertedRecords.length;

    // Calculate summary data
    const summaryData = {
        totalRecords: totalRecords,
        insertedSuccessfully: insertedRecords.length,
        notInserted: notInserted,
        errors: errors,
    };

    // Render the import summary data as HTML
    const summaryHTML = `
        <h2>Import Summary</h2>
        <p><strong>Total records processed:</strong> ${summaryData.totalRecords}</p>
        <p><strong>Records inserted successfully:</strong> ${summaryData.insertedSuccessfully}</p>
        <p><strong>Records not inserted:</strong> ${summaryData.notInserted}</p>
        <p><strong>Errors:</strong> ${JSON.stringify(summaryData.errors)}</p>
    `;

    // Send the summary data as a response
    res.send(summaryHTML);
});
