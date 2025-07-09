import cv2
import numpy as np
import torch
from ultralytics import YOLO

# Load the YOLO model from the local weights file
model_path = 'C:/Users/angel/Downloads/model (4)/content/runs/detect/train/weights/best.pt'  # Update this path
model = YOLO(model_path, verbose=False)  # Load YOLOv11 model

# Open the webcam
cap = cv2.VideoCapture(0)

# Start video stream and human detection
while True:
    ret, frame = cap.read()  # Capture frame-by-frame
    if not ret:
        break

    # Get original frame dimensions
    orig_height, orig_width = frame.shape[:2]

    # Resize the frame for YOLO model (YOLO expects a square input, 640x640)
    input_size = 640
    frame_resized = cv2.resize(frame, (input_size, input_size))

    # Detect humans using the YOLO model
    results = model(frame_resized, verbose=False)

    # Check for boxes in the results
    if results and results[0].boxes:
        boxes = results[0].boxes
        # Draw bounding boxes on the original frame
        for box in boxes:
            if box.conf[0] > 0.5:  # Adjust confidence threshold
                x1, y1, x2, y2 = map(int, box.xyxy[0])  # Get coordinates in resized frame

                # Scale the coordinates back to the original frame size
                x1 = int(x1 * orig_width / input_size)
                y1 = int(y1 * orig_height / input_size)
                x2 = int(x2 * orig_width / input_size)
                y2 = int(y2 * orig_height / input_size)

                label = 'Human'
                # Draw bounding box on the original frame
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                # Add label and confidence to the image
                cv2.putText(frame, f'{label} {box.conf[0]:.2f}', (x1, y1 - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    # Display the resulting frame with bounding boxes
    cv2.imshow('Human Detection', frame)

    # Break the loop if 'q' is pressed
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Release the webcam and close windows
cap.release()
cv2.destroyAllWindows()
