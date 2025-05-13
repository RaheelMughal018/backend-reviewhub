// Import required libraries
const express = require('express');
const db = require('./dbConfig');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/apiRoutes'); 
const cors = require('cors'); // Import the cors middleware

// Create an instance of Express
const app = express();
app.use(cors()); // Enable CORS for all routes


// Middleware to parse incoming requests with JSON payloads
app.use(bodyParser.json());



// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL database:', err);
    return;
  }
  console.log('Connected to the MySQL database');
});


// Mount the API routes
app.use('/api', apiRoutes);

// Start the server
const port = 3000; // You can change this to any port you prefer
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
