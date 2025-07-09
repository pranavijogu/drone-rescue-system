from dronekit import connect, VehicleMode, LocationGlobalRelative
import socket
import json
import time
import logging
import math

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

class DroneController:
    def __init__(self):
        try:
            # Connect to drone through telemetry
            self.connection_string = "COM9"  # Modify with your actual connection string
            self.vehicle = connect(self.connection_string, baud=57600, wait_ready=False)
            logging.info("Drone connected successfully")
            
            # Connect to Jetson Xavier
            self.client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.xavier_ip = '192.168.1.X'  # Replace with Xavier's IP
            self.xavier_port = 5000
            
            # Initialize ToF sensor
            self.sensor_altitude = 0.0
            self.setup_altitude_sensor()
            
        except Exception as e:
            logging.error(f"Initialization error: {e}")
            raise

    def setup_altitude_sensor(self):
        def distance_sensor_callback(self, name, message):
            """Callback function to handle DISTANCE_SENSOR MAVLink messages."""
            self.sensor_altitude = message.current_distance / 100.0  # Convert cm to meters
        self.vehicle.add_message_listener('DISTANCE_SENSOR', distance_sensor_callback)

    def arm_and_takeoff(self, target_altitude):
        """Arm the drone and take off to target altitude."""
        logging.info("Arming motors")
        
        while not self.vehicle.is_armable:
            logging.info("Waiting for vehicle to initialize...")
            time.sleep(1)
            
        self.vehicle.mode = VehicleMode("GUIDED")
        self.vehicle.armed = True
        
        while not self.vehicle.armed:
            logging.info("Waiting for arming...")
            time.sleep(1)
            
        logging.info("Taking off")
        self.vehicle.simple_takeoff(target_altitude)
        
        while True:
            logging.info(f"Altitude: {self.sensor_altitude} meters (sensor)")
            if self.sensor_altitude >= target_altitude * 0.95:
                logging.info("Reached target altitude")
                break
            time.sleep(1)

    def drop_payload(self):
        """Drop the payload using servo control."""
        try:
            logging.info("Dropping payload using Channel 8")
            self.vehicle.channels.overrides = {'8': 2100}  # Open Servos
            logging.info("Servos Opened (PWM: 2100)")
            time.sleep(10)  # Keep servos open for 10 seconds
            self.vehicle.channels.overrides = {'8': 1000}  # Close servos
            logging.info("Servos Closed")
        except Exception as e:
            logging.error(f"Payload drop error: {e}")

    def get_distance_meters(self, location1, location2):
        """Calculate distance between two locations in meters."""
        dlat = location2.lat - location1.lat
        dlon = location2.lon - location1.lon
        return math.sqrt((dlat ** 2) + (dlon ** 2)) * 1.113195e5

    def execute_mission(self):
        """Execute the complete mission including detection and payload delivery."""
        try:
            # Connect to Xavier
            logging.info(f"Connecting to Xavier at {self.xavier_ip}:{self.xavier_port}")
            self.client_socket.connect((self.xavier_ip, self.xavier_port))
            logging.info("Connected to detection server")

            # Take off
            target_altitude = 10  # 10m initial altitude
            self.arm_and_takeoff(target_altitude)
            
            # Wait for detection data
            logging.info("Waiting for human detection data...")
            data = self.client_socket.recv(1024).decode()
            coords = json.loads(data)
            logging.info(f"Received coordinates: {coords}")

            # Move to detected location
            target = LocationGlobalRelative(
                coords['latitude'],
                coords['longitude'],
                self.sensor_altitude
            )
            logging.info(f"Moving to target location: {target}")
            self.vehicle.simple_goto(target)

            # Wait until reached target
            while True:
                current = self.vehicle.location.global_relative_frame
                distance = self.get_distance_meters(current, target)
                logging.info(f"Distance to target: {distance:.2f} meters")
                if distance < 2:  # Within 2 meters
                    logging.info("Reached target location")
                    break
                time.sleep(1)

            # Lower altitude for payload drop
            logging.info("Lowering altitude for payload drop")
            lower_location = LocationGlobalRelative(
                target.lat,
                target.lon,
                5  # Lower altitude for drop
            )
            self.vehicle.simple_goto(lower_location)
            time.sleep(5)  # Wait for altitude adjustment

            # Drop payload
            self.drop_payload()

            # Return to launch
            logging.info("Mission complete, returning to launch")
            self.vehicle.mode = VehicleMode("RTL")
            
        except Exception as e:
            logging.error(f"Mission failed: {e}")
            self.vehicle.mode = VehicleMode("RTL")
            
        finally:
            logging.info("Cleaning up connections")
            self.client_socket.close()
            self.vehicle.close()

if __name__ == "__main__":
    try:
        controller = DroneController()
        controller.execute_mission()
    except Exception as e:
        logging.error(f"Program error: {e}")


