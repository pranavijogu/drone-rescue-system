import torch
import cv2
import os
import math
import json
import socket
import logging
from datetime import datetime
from utils.pixhawk_connection import PixhawkConnection

class DetectionServer:
    def __init__(self):
        # Initialize logging
        logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
        
        try:
            # Initialize YOLO
            self.model = torch.hub.load('ultralytics/yolov5', 'custom', path='/path/to/your/best.pt')
            self.model.conf = 0.25
            logging.info("YOLO model loaded successfully")

            # Initialize camera
            self.cap = cv2.VideoCapture(0)  # /dev/video0 for GoPro
            if not self.cap.isOpened():
                raise Exception("Cannot open GoPro camera")
            logging.info("Camera initialized successfully")

            # Initialize Pixhawk connection
            self.pixhawk = PixhawkConnection()
            logging.info("Pixhawk connection established")
            
            # Initialize network server
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.bind(('0.0.0.0', 5000))
            self.server_socket.listen(1)
            logging.info("Detection server started on port 5000")

        except Exception as e:
            logging.error(f"Initialization error: {e}")
            raise

    def calculate_coordinates(self, detection, frame_width, frame_height):
        # Get current drone position
        gps_data = self.pixhawk.get_gps_coordinates()
        if not gps_data:
            raise Exception("Could not get GPS coordinates")
        
        current_lat, current_lon, current_alt = gps_data

        # Get bounding box coordinates
        x_min, y_min, x_max, y_max = detection[:4]
        bbox_center_x = (x_min + x_max) / 2
        bbox_center_y = (y_min + y_max) / 2

        # Calculate distance from center of frame
        fov = 45  # Camera field of view in degrees
        fov_rad = math.radians(fov)
        horizontal_fov_meters = 2 * current_alt * math.tan(fov_rad / 2)
        pixel_size_meters = horizontal_fov_meters / frame_width

        distance = math.sqrt((bbox_center_x - frame_width / 2) ** 2 + 
                           (bbox_center_y - frame_height / 2) ** 2)
        distance_meters = distance * pixel_size_meters

        # Convert to latitude/longitude changes
        meters_per_degree_lat = 111320
        meters_per_degree_lon = 40075000 * math.cos(math.radians(current_lat)) / 360

        # Calculate direction and offset
        angle = math.atan2(bbox_center_y - frame_height/2, 
                          bbox_center_x - frame_width/2)
        
        delta_lat = (distance_meters * math.cos(angle)) / meters_per_degree_lat
        delta_lon = (distance_meters * math.sin(angle)) / meters_per_degree_lon

        target_lat = current_lat + delta_lat
        target_lon = current_lon + delta_lon

        return {
            'latitude': target_lat,
            'longitude': target_lon,
            'altitude': current_alt,
            'distance': distance_meters,
            'confidence': float(detection[4])
        }

    def run(self):
        while True:
            logging.info("Waiting for ground station connection...")
            client, addr = self.server_socket.accept()
            logging.info(f"Connected to ground station: {addr}")

            try:
                while True:
                    ret, frame = self.cap.read()
                    if not ret:
                        logging.warning("Failed to grab frame")
                        continue

                    # Run detection
                    results = self.model(frame)
                    detections = results.xyxy[0].cpu().numpy()

                    if len(detections) > 0:
                        # Get first detection
                        detection = detections[0]
                        frame_height, frame_width = frame.shape[:2]
                        
                        try:
                            # Calculate coordinates
                            coords = self.calculate_coordinates(detection, frame_width, frame_height)
                            
                            # Send to ground station
                            client.send(json.dumps(coords).encode())
                            
                            # Save detection image
                            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                            cv2.imwrite(f"detection_{timestamp}.jpg", results.render()[0])
                            logging.info(f"Detection saved: detection_{timestamp}.jpg")
                            
                            # Stop after first successful detection
                            break
                            
                        except Exception as e:
                            logging.error(f"Error processing detection: {e}")

            except Exception as e:
                logging.error(f"Connection error: {e}")
            finally:
                client.close()

    def cleanup(self):
        self.cap.release()
        cv2.destroyAllWindows()
        self.server_socket.close()

if __name__ == "__main__":
    server = DetectionServer()
    try:
        server.run()
    except KeyboardInterrupt:
        logging.info("Shutting down server...")
    finally:
        server.cleanup()