const express = require('express');
const axios = require('axios');
const db = require('../dbConfig');
const transporter = require('../emailSender.js');
const router = express.Router();
const jwt = require('jsonwebtoken');
const csv = require('csv-parser');
const fs = require('fs');
const { Transform } = require('stream');
const JSONStream = require('JSONStream');
const ytscraper = require('../ScrapperScript.js')
const scrapeAmazonReviews = require('../amazonscrapper.js')

// Function to generate a JWT token

const generateToken = (user) => {
  return jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' }); // Replace 'your-secret-key' with an actual secret key
};

// Function to verify JWT token
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🚀 ~ verifyToken ~ decoded:", decoded)
    return decoded;
  } catch (err) {
    return null;
  }
};
// GET endpoint to retrieve users from the database and send them as JSON
router.get('/users', (req, res) => {
  const query = 'SELECT * FROM user'; // Replace 'users' with the name of your table
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching users:', err);
      res.status(500).json({ error: 'Failed to fetch users' });
    } else {
      res.json(results);
    }
  });
});

router.post('/signup', async (req, res) => {
  const { email, name, password } = req.body;
  

  // Ensure that required fields are provided
  if (!email || !name || !password) {
    return res.status(403).json({ error: 'All fields are required' });
  }
  if(password.length < 8){
    return res.json({ error: 'Password must be at least 8 characters long' });
  }
  const Verfication_Code = generateVerificationCode(); // Generate a random 6-digit verification code

  try {
    let mail = await transporter.sendMail({
      from: '"Review HUB" <raheelmughal018@gmail.com>',
      to: `${email}`,
      subject: "Verification Code",
      text: "Verification OTP",
      html: `
        <p>Dear ${name},</p>
        <p>Your One-Time Password (OTP) for verification is:</p>
        <h1>${Verfication_Code}</h1>
        <p>Please use this OTP to complete the verification process.</p>
        <p>Thank you!</p>
      `
    });

    // Insert user into the database
    const query = 'INSERT INTO user (email, name, password, two_FA_key) VALUES (?, ?, ?,?)';
    db.query(query, [email, name, password, Verfication_Code], (err, results) => {
      if (err) {
        console.error('Error creating user:', err);
        res.status(500).json({ error: 'Failed to create user' });
      } else {
        res.status(201).json({ message: 'User created successfully' });
      }
    });

  } catch (error) {
    console.error('Error sending email:', error);
    res.status(503).json({ error: 'Failed to send verification email' });
  }
});



router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' }); // Changed 403 to 400
  }

  try {
    const query = 'SELECT * FROM user WHERE email = ? AND password = ?';
    const results = await new Promise((resolve, reject) => {
      db.query(query, [email, password], (err, results) => {
        if (err) {
          reject(err);
        } else {
          resolve(results);
        }
      });
    });

    if (results.length > 0) {
      const user = results[0];
      const token = generateToken(user);
      return res.status(200).json({ message: 'Login successful', token }); // Changed 201 to 200
    } else {
      return res.status(401).json({ error: 'Invalid email or password' }); // Left as 401
    }
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Failed to process login' });
  }
});




router.post('/users/email', (req, res) => {

  const {email } = req.body;
  // console.log(email);

  const query = `SELECT * FROM user WHERE email = '${email}'`;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching users:', err);
      res.status(500).json({ error: 'Failed to fetch users' });
    } else {
      res.json(results);
    }
  });
});

const generateVerificationCode = () => {
  // Generate a random 6-digit number (between 100000 and 999999)
  return Math.floor(100000 + Math.random() * 900000);
};


router.get('/profile', (req, res) => {
  const {token}= req.cookies;
  jwt.verify(token, secret,{},(err,info)=>{
      if(err) throw err;
      res.json(info);
  })
  res.json(req.cookies); // Use req.cookies to access cookies
});

router.delete('/users/email', (req, res) => {
  const { email } = req.body;
  console.log('Deleting user with email:', email);

  const deleteQuery = `DELETE FROM users WHERE email = '${email}'`;

  db.query(deleteQuery, (err, result) => {
    if (err) {
      console.error('Error deleting user:', err);
      res.status(500).json({ error: 'Failed to delete user' });
    } else {
      // Check if any rows were affected (if no user with the given email was found)
      if (result.affectedRows === 0) {
        res.status(404).json({ message: 'User not found' });
      } else {
        res.json({ message: 'User deleted successfully' });
      }
    }
  });
});

router.post('/users/contact', (req, res) => {
  
});
// Define a simple route to test the server
router.get('/hello', (req, res) => {
  res.json({ message: 'Hello, World!' });
});


//my work

router.post('/contact', async (req, res) => {
  const { email, name, message } = req.body;

  // Ensure that required fields are provided
  if (!email || !name || !message) {
    return res.status(403).json({ error: 'All fields are required' });
  }

  // SQL to create the feedback table if it doesn't exist
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      feedback TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  try {
    // Ensure the table exists
    await new Promise((resolve, reject) => {
      db.query(createTableQuery, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Save feedback data to the database
    const insertFeedbackQuery = 'INSERT INTO feedback (email, feedback) VALUES (?, ?)';
    db.query(insertFeedbackQuery, [email, message], (err, results) => {
      if (err) {
        console.error('Error saving feedback to database:', err);
        // You can choose to handle the error as needed
      }
    });

    // Send email
    let mail = await transporter.sendMail({
      from: '"Review HUB" <raheelmughal018@gmail.com>',
      to: '70128174@student.uol.edu.pk', // Replace with the desired destination email address
      subject: 'Contact Form Submission',
      text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
      html: `
        <p>Name: ${name}</p>
        <p>Email: ${email}</p>
        <p>Message: ${message}</p>
      `,
    });
    console.log("🚀 ~ router.post ~ mail:", mail)

    res.status(201).json({ message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error sending email or saving feedback to database:', error);
    res.status(503).json({ error: 'Failed to send email or save feedback' });
  }
});



var emailchng=null

router.post('/frpass', (req, res) => {
  const { email } = req.body;
  console.log(email);
  emailchng=email
  const verificationCode = generateVerificationCode();

  const query = `SELECT * FROM user WHERE email = '${email}'`; // Assuming 'user' is the table name

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching user:', err);
      res.status(500).json({ error: 'Failed to fetch user' });
    } else {
      if (results.length > 0) {
        let mail = transporter.sendMail({
          from: '"Review HUB" <raheelmugha018@gmail.com>',
          to: `${email}`,
          subject: 'Verification Code',
          text: 'Verification OTP',
          html: `
            <p>Your One-Time Password (OTP) for verification is:</p>
            <h1>${verificationCode}</h1>
            <p>Please use this OTP to complete the verification process.</p>
            <p>Thank you!</p>
          `,
        });

        console.log(`Verification code sent to ${email}: ${verificationCode}`);
        res.json({ verificationCode });
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    }
  });
});


router.post('/chngPass', (req, res) => {
  const { newPassword } = req.body;

  try {
    // Update user's password
    const query = 'UPDATE user SET password = ? WHERE email = ?';
    db.query(query, [newPassword, emailchng], (err, results) => {
      if (err) {
        console.error('Error updating password:', err);
        return res.status(500).json({ message: 'Failed to update password' });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      console.log("working")
      return res.status(200).json({ message: 'Password updated successfully' });
      
    });
  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(500).json({ message: 'Failed to update password' });
  }
});

router.post('/receive_json', (req, res) => {
  const jsonData = req.body
  console.log('Received JSON data:', jsonData);
  // Handle the JSON data as needed
  res.send('JSON data received successfully');
});




// Define a route for scraping data
router.post('/scrape_data', async (req, res) => {
  console.log("Checking if the server is up and running...");
  try {
    // Extract the YouTube video URL from the request body
    const videoUrl  = req.body.videoURL;

    // Check if the videoUrl is provided
    if (!videoUrl) {
      return res.status(400).json({ error: 'Video URL is required' });
    }
    
    // Call the ytscraper function with the provided videoUrl
    const scrapedData = await ytscraper(videoUrl);
    
    // // Convert scraped data to CSV format
    // const csvData = await convertToCSV(scrapedData);
    
    // Send a response with the scraped data in CSV format
    res.header('Content-Type', 'text/csv');
    res.attachment('comments.csv');
    
    // console.log("🚀 ~ router.post ~ scrapedData:", scrapedData)
    // console.log(scrapedData)

    res.status(200).send(scrapedData);
  } catch (error){
    console.error('error scraping data:', error);

    // Send a meaningful error response
    res.status(500).json({ error: 'An error occurred while scraping data. Please try again later.' });
  }
});

// Function to convert JSON data to CSV format

router.post('/scrape_amazon', async (req, res) => {
  console.log("Checking if the server is up and running...");
  try {
    // Extract the YouTube video URL from the request body
    const videoUrl  = req.body.videoURL;

    // Check if the videoUrl is provided
    if (!videoUrl) {
      return res.status(400).json({ error: 'Video URL is required' });
    }

    
    const scrapedData = await scrapeAmazonReviews(videoUrl);

    res.header('Content-Type', 'text/csv');
    res.attachment('comments.csv');

    console.log(scrapedData)
 
    res.status(200).send(scrapedData);
  } catch (error) {
    console.error('Error scraping data:', error);

    // Send a meaningful error response
    res.status(500).json({ error: 'An error occurred while scraping data. Please try again later.' });
  }
});


module.exports = router;
