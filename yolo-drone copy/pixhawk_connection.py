from pymavlink import mavutil
import time
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

class PixhawkConnection:
    def __init__(self):
        try:
            # Connect to Pixhawk
            self.connection = mavutil.mavlink_connection(
                'udpin:0.0.0.0:14550',  # For UDP connection
                baud=57600
            )
            
            # Wait for the first heartbeat 
            logging.info("Waiting for Pixhawk heartbeat...")
            self.connection.wait_heartbeat()
            logging.info("Heartbeat received!")

            # Request position data stream
            self.request_data_stream()

        except Exception as e:
            logging.error(f"Failed to connect to Pixhawk: {e}")
            raise

    def request_data_stream(self):
        """Request GPS data stream from Pixhawk"""
        self.connection.mav.request_data_stream_send(
            self.connection.target_system,
            self.connection.target_component,
            mavutil.mavlink.MAV_DATA_STREAM_POSITION,
            1,  # 1 Hz update rate
            1   # 1 = start sending, 0 = stop sending
        )

    def get_gps_coordinates(self):
        """Get current GPS coordinates from Pixhawk"""
        try:
            msg = self.connection.recv_match(
                type='GLOBAL_POSITION_INT', 
                blocking=True,
                timeout=5
            )
            if msg:
                latitude = msg.lat / 1e7   # Convert from int32 to degrees
                longitude = msg.lon / 1e7
                altitude = msg.relative_alt / 1000  # Convert from millimeters to meters
                return latitude, longitude, altitude
            else:
                logging.warning("No GPS data received")
                return None
        except Exception as e:
            logging.error(f"Error getting GPS data: {e}")
            return None