const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb+srv://Pranavi:Pranavi123@cluster0.a6y6cue.mongodb.net/Drone', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('DB connection successful');
}).catch(error => {
  console.error('Error connecting to MongoDB:', error);
});

// Define Schemas
const { Schema, model } = mongoose;

const EventSchema = new Schema({
  event_type: String,
  timestamp: String,
  location: {
    latitude: Number,
    longitude: Number,
  }
});

const TelemetrySchema = new Schema({
  timestamp: Number,
  latitude: Number,
  longitude: Number,
  altitude: Number,
  groundspeed: Number
});

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

const FlightLog = model('FlightLog', FlightLogSchema, "flight_logs");

// Sample Data
const sampleData = {
  drone_id: "drone001",
  flight_summary: {
    start_time: "2024-11-13T10:00:00Z",
    end_time: "2024-11-13T10:30:00Z",
    max_altitude: 45.0,
    average_speed: 3.7,
    distance_traveled: 1000
  },
  events: [
    {
      event_type: "takeoff",
      timestamp: "2024-11-13T10:00:00Z",
      location: { latitude: 17.3969, longitude: 78.4900 }
    },
    {
      event_type: "person_detected",
      timestamp: "2024-11-13T10:10:00Z",
      location: { latitude: 17.3971, longitude: 78.4905 }
    },
    {
      event_type: "payload_dropped",
      timestamp: "2024-11-13T10:15:00Z",
      location: { latitude: 17.3980, longitude: 78.4910 }
    },
    {
      event_type: "landing",
      timestamp: "2024-11-13T10:30:00Z",
      location: { latitude: 17.3969, longitude: 78.4900 }
    }
  ],
  telemetry: [
    { timestamp: 135000, latitude: 17.3969, longitude: 78.4900, altitude: 10.0, groundspeed: 0.0 },
    { timestamp: 135100, latitude: 17.3970, longitude: 78.4901, altitude: 15.0, groundspeed: 2.0 },
    { timestamp: 135200, latitude: 17.3971, longitude: 78.4902, altitude: 20.0, groundspeed: 3.5 },
    { timestamp: 135300, latitude: 17.3972, longitude: 78.4903, altitude: 25.0, groundspeed: 4.0 },
    { timestamp: 135400, latitude: 17.3973, longitude: 78.4904, altitude: 30.0, groundspeed: 3.8 },
    { timestamp: 135500, latitude: 17.3974, longitude: 78.4905, altitude: 35.0, groundspeed: 3.6 }
  ]
};

// Insert Sample Data
const insertSampleData = async () => {
  try {
    const newFlightLog = new FlightLog(sampleData);
    await newFlightLog.save();
    console.log('Sample data inserted successfully');
    mongoose.connection.close(); // Close the connection after insertion
  } catch (error) {
    console.error('Error inserting data:', error);
  }
};

insertSampleData();