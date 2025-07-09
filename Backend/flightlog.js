// backend/models/FlightLog.js

const mongoose = require('mongoose');
const { Schema, model } = mongoose;

// Define Event Schema
const EventSchema = new Schema({
  event_type: String,
  timestamp: String,
  location: {
    latitude: Number,
    longitude: Number,
  }
});

// Define Telemetry Schema
const TelemetrySchema = new Schema({
  timestamp: Number,
  latitude: Number,
  longitude: Number,
  altitude: Number,
  groundspeed: Number
});

// Define FlightLog Schema
const FlightLogSchema = new Schema({
  drone_id: String,
  flight_summary: {
    start_time: String,
    end_time: String,
    max_altitude: Number,
    average_speed: Number,
    distance_traveled: Number,
  },
  events: [EventSchema],
  telemetry: [TelemetrySchema]
});

// Create Model
const FlightLog = model('FlightLog', FlightLogSchema, "flight_logs");

module.exports = FlightLog;
