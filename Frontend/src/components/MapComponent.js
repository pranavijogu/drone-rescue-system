import React, { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { GoogleMap, Polyline, useLoadScript } from '@react-google-maps/api';
import axios from 'axios';
import './MapComponent.css';


const libraries = ['drawing', 'places'];

const MapComponent = forwardRef(({ onDispatchDrone }, ref) => {
  const [selectedArea, setSelectedArea] = useState(null);
  const [drawingManager, setDrawingManager] = useState(null);
  const [gridLines, setGridLines] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add states for draggable camera feed
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0 });

  const center = {
    lat: 17.39716,
    lng: 78.49040,
  };

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: 'AIzaSyB-6NuWru71NBpaRmAaiEZjRmTJnUfQBbQ',
    libraries,
  });

  const searchBoxRef = useRef(null);
  const mapRef = useRef(null);
  const autocompleteRef = useRef(null);

  // Handle drag start
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.pageX - cameraPosition.x,
      startY: e.pageY - cameraPosition.y
    };
    e.preventDefault();
    e.stopPropagation(); // Prevent text selection while dragging
  };

  // Handle dragging
const handleMouseMove = useCallback((e) => {
  if (!isDragging) return;

  const newX = e.pageX - dragRef.current.startX;
  const newY = e.pageY - dragRef.current.startY;

  // Get map container boundaries
  const mapContainer = document.querySelector('.map-wrapper');
  const cameraFeed = document.querySelector('.drone-camera-feed');
  
  if (mapContainer && cameraFeed) {
    const mapRect = mapContainer.getBoundingClientRect();
    const feedRect = cameraFeed.getBoundingClientRect();

    // Constrain within map boundaries
    const maxX = mapRect.width - feedRect.width;
    const maxY = mapRect.height - feedRect.height;
    const minY = 70; // Minimum Y position to avoid search bar

    setCameraPosition({
      x: Math.min(Math.max(0, newX), maxX),
      y: Math.min(Math.max(minY, newY), maxY)
    });
  }
}, [isDragging]);


  
  // Handle drag end
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add event listeners for dragging
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove]);

  useImperativeHandle(ref, () => ({
    handleDispatchDrone: () => {
      if (selectedArea) {
        dispatchDroneToArea(selectedArea);
      } else {
        onDispatchDrone('Please select an area on the map first');
      }
    }
  }));

  const mapContainerStyle = {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  };

  const mapOptions = {
    zoom: 18,
    center: center,
    mapTypeId: 'satellite',
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    zoomControl: true,
  };

  const onLoad = useCallback((map) => {
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      const drawingManagerInstance = new window.google.maps.drawing.DrawingManager({
        drawingMode: null,
        drawingControl: false,
      });
  
      drawingManagerInstance.setMap(map);
      setDrawingManager(drawingManagerInstance);
  
      // Create custom buttons for "Draw Rectangle" and "Stop Drawing"
      const drawRectangleButton = document.createElement('button');
      drawRectangleButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="black">
        <rect x="4" y="4" width="16" height="16" />
      </svg>`;
      drawRectangleButton.className = 'custom-drawing-button';
      
      const stopDrawingButton = document.createElement('button');
      stopDrawingButton.innerHTML = '&#9995;';
      stopDrawingButton.className = 'custom-drawing-button';
  
      drawRectangleButton.addEventListener('click', () => {
        drawingManagerInstance.setDrawingMode(window.google.maps.drawing.OverlayType.RECTANGLE);
      });
  
      stopDrawingButton.addEventListener('click', () => {
        drawingManagerInstance.setDrawingMode(null);
      });
  
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'custom-drawing-controls';
      buttonContainer.appendChild(drawRectangleButton);
      buttonContainer.appendChild(stopDrawingButton);
  
      map.controls[window.google.maps.ControlPosition.RIGHT_TOP].push(buttonContainer);
  
      window.google.maps.event.addListener(drawingManagerInstance, 'rectanglecomplete', (rectangle) => {
        const bounds = rectangle.getBounds();
        const selectedBounds = bounds.toJSON();
        setSelectedArea(selectedBounds);
        drawGrid(selectedBounds);
      });
    }
  }, []);

  const onUnmount = useCallback(() => {
    if (drawingManager) {
      drawingManager.setMap(null);
    }
  }, [drawingManager]);

  const drawGrid = (area) => {
    const gridLinesArray = [];
    const latStep = (area.north - area.south) / 10;
    const lngStep = (area.east - area.west) / 50;
  
    for (let i = 0; i <= 50; i++) {
      const lng = area.west + lngStep * i;
      const latStart = area.south;
      const latEnd = area.north;
  
      gridLinesArray.push([
        { lat: latStart, lng },
        { lat: latEnd, lng }
      ]);
    }
  
    setGridLines(gridLinesArray);
  };

  const handleSearch = useCallback(() => {
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      if (searchBoxRef.current && !autocompleteRef.current) {
        autocompleteRef.current = new window.google.maps.places.Autocomplete(
          searchBoxRef.current,
          { types: ['geocode'] }
        );

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current.getPlace();
          if (place.geometry) {
            const { lat, lng } = place.geometry.location;
            setSelectedLocation({ lat: lat(), lng: lng() });
            mapRef.current.panTo(place.geometry.location);
            setSearchTerm('');
          } else {
            alert("No details available for the selected place.");
          }
        });
      }
    }
  }, []);

  const handleSearchInputChange = (e) => {
    setSearchTerm(e.target.value);
    if (!autocompleteRef.current) {
      handleSearch(); // Initialize Autocomplete only if not already set up
    }
  };

  const dispatchDroneToArea = async (area) => {
    try {
      const requestData = {
        top_left: {
          latitude: parseFloat(area.north).toFixed(6),
          longitude: parseFloat(area.west).toFixed(6),
        },
        bottom_right: {
          latitude: parseFloat(area.south).toFixed(6),
          longitude: parseFloat(area.east).toFixed(6),
        },
      };

      const response = await axios.post('http://172.168.35.117:3001/drone/dispatch/rectangle', requestData);
      console.log('Drone dispatched:', response.data);
      onDispatchDrone('Drone successfully dispatched to the selected area');
    } catch (error) {
      console.error('Error dispatching drone:', error);
      onDispatchDrone('Failed to dispatch drone: ' + error.message);
    }
  };

  if (loadError) {
    return <div className="map-error">Error loading maps</div>;
  }

  if (!isLoaded) {
    return <div className="map-loading">Loading maps...</div>;
  }

  return (
    <div className="map-wrapper">
      {/* Search input with controlled value */}
      <input
        ref={searchBoxRef}
        type="text"
        placeholder="Search a place"
        className="search-box"
        value={searchTerm} // Controlled input
        onChange={handleSearchInputChange} // Update search term as user types
      />

      {/* Draggable Drone Camera Feed */}
      <div 
        className="drone-camera-feed"
        style={{
          transform: `translate(${cameraPosition.x}px, ${cameraPosition.y}px)`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="camera-feed-header">
          <div className="camera-feed-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Drone Camera Feed
          </div>
          <div className="camera-feed-controls">
            <div className="live-indicator">
              <div className="live-dot"></div>
              LIVE
            </div>
            <button 
              className="fullscreen-button"
              onClick={() => window.open('/camera-feed', '_blank')}
              title="Open in fullscreen"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 3h6v6M14 10l7-7M9 21H3v-6M10 14l-7 7" />
              </svg>
            </button>
          </div>
        </div>
        <div className="camera-feed-content">
    <img 
        src="http://127.0.0.1:5001/video-feed" 
        alt="Drone Camera Feed" 
        className="live-feed" 
    />
</div>



      </div>

      <GoogleMap
        ref={mapRef}
        mapContainerStyle={mapContainerStyle}
        options={mapOptions}
        onLoad={onLoad}
        onUnmount={onUnmount}
        center={selectedLocation || center}
      >
        {gridLines.map((line, index) => (
          <Polyline
            key={index}
            path={line}
            options={{
              strokeColor: '#00FF00',
              strokeOpacity: 0.6,
              strokeWeight: 2,
            }}
          />
        ))}
      </GoogleMap>
    </div>
  );
});

export default MapComponent;