// backend/routes/flightHistory.js
const express = require('express');
const router = express.Router();
const FlightLog = require('../FlightLog');

// GET endpoint to fetch all flight logs
router.get('/history', async (req, res) => {
  try {
    const flightLogs = await FlightLog.find({});
    res.json(flightLogs);
  } catch (error) {
    console.error('Error fetching flight logs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
