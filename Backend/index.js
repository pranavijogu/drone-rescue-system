const express = require('express');
const mongoose = require('mongoose');
const flightHistoryRoute = require('./routes/flightHistory');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose.connect('mongodb+srv://Pranavi:Pranavi123@cluster0.a6y6cue.mongodb.net/Drone', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('DB connection successful');
}).catch(error => {
  console.error('Error connecting to MongoDB:', error);
});

// Middleware
app.use(express.json());

// Routes
app.use('/api/flight-history', flightHistoryRoute);

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
