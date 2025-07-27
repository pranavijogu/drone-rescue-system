import React, { useState, useCallback, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Map } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import axios from 'axios';
import './MapComponent.css';



const MapComponent = forwardRef(({ onDispatchDrone }, ref) => {
  const [selectedArea, setSelectedArea] = useState(null);
  const [gridLines, setGridLines] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [map, setMap] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Add states for draggable camera feed
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0 });

  const mapContainer = useRef(null);
  const searchBoxRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const center = [78.49040, 17.39716]; // [lng, lat] for MapLibre

  // Draw grid function
  const drawGrid = useCallback((area, mapInstance) => {
    // Remove existing grid
    if (mapInstance.getSource('grid')) {
      mapInstance.removeLayer('grid-lines');
      mapInstance.removeSource('grid');
    }

    const gridLines = [];
    const latStep = (area.north - area.south) / 10;
    const lngStep = (area.east - area.west) / 50;

    // Create vertical lines
    for (let i = 0; i <= 50; i++) {
      const lng = area.west + lngStep * i;
      gridLines.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [lng, area.south],
            [lng, area.north]
          ]
        }
      });
    }

    // Add grid source and layer
    mapInstance.addSource('grid', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: gridLines
      }
    });

    mapInstance.addLayer({
      id: 'grid-lines',
      type: 'line',
      source: 'grid',
      paint: {
        'line-color': '#00FF00',
        'line-width': 1,
        'line-opacity': 0.6
      }
    });
  }, []);

  // Setup drawing controls
  const setupDrawingControls = useCallback((mapInstance) => {
    // Create custom drawing controls
    const drawButton = document.createElement('button');
    drawButton.innerHTML = '📐 Draw';
    drawButton.className = 'maplibregl-ctrl-icon custom-draw-button';
    drawButton.title = 'Draw Rectangle';
    
    const stopButton = document.createElement('button');
    stopButton.innerHTML = '✋ Stop';
    stopButton.className = 'maplibregl-ctrl-icon custom-stop-button';
    stopButton.title = 'Stop Drawing';

    // Create control container
    const controlGroup = document.createElement('div');
    controlGroup.className = 'maplibregl-ctrl maplibregl-ctrl-group custom-control-group';
    controlGroup.appendChild(drawButton);
    controlGroup.appendChild(stopButton);

    // Add to map container (not the map itself)
    const mapContainer = mapInstance.getContainer();
    mapContainer.appendChild(controlGroup);
    
    // Position the controls
    controlGroup.style.position = 'absolute';
    controlGroup.style.top = '10px';
    controlGroup.style.right = '10px';
    controlGroup.style.zIndex = '1000';

    let startPoint = null;
    let isCurrentlyDrawing = false;

    const startDrawing = () => {
      isCurrentlyDrawing = true;
      setIsDrawing(true);
      mapInstance.getCanvas().style.cursor = 'crosshair';
      drawButton.style.backgroundColor = '#4CAF50';
      drawButton.style.color = 'white';
    };

    const stopDrawing = () => {
      isCurrentlyDrawing = false;
      setIsDrawing(false);
      mapInstance.getCanvas().style.cursor = '';
      startPoint = null;
      drawButton.style.backgroundColor = '';
      drawButton.style.color = '';
    };

    drawButton.addEventListener('click', startDrawing);
    stopButton.addEventListener('click', stopDrawing);

    // Handle rectangle drawing
    const handleMouseDown = (e) => {
      if (!isCurrentlyDrawing) return;
      e.preventDefault();
      startPoint = [e.lngLat.lng, e.lngLat.lat];
      console.log('Drawing started at:', startPoint);
    };

    const handleMouseMove = (e) => {
      if (!isCurrentlyDrawing || !startPoint) return;
      
      const currentPoint = [e.lngLat.lng, e.lngLat.lat];
      
      // Remove existing rectangle
      if (mapInstance.getSource('rectangle')) {
        try {
          mapInstance.removeLayer('rectangle-fill');
          mapInstance.removeLayer('rectangle-line');
          mapInstance.removeSource('rectangle');
        } catch (error) {
          // Source might not exist, continue
        }
      }

      // Create rectangle coordinates
      const rectangleCoords = [
        [startPoint[0], startPoint[1]], // SW
        [currentPoint[0], startPoint[1]], // SE
        [currentPoint[0], currentPoint[1]], // NE
        [startPoint[0], currentPoint[1]], // NW
        [startPoint[0], startPoint[1]], // Close
      ];

      // Add rectangle source and layers
      mapInstance.addSource('rectangle', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [rectangleCoords]
          }
        }
      });

      mapInstance.addLayer({
        id: 'rectangle-fill',
        type: 'fill',
        source: 'rectangle',
        paint: {
          'fill-color': '#00FF00',
          'fill-opacity': 0.3
        }
      });

      mapInstance.addLayer({
        id: 'rectangle-line',
        type: 'line',
        source: 'rectangle',
        paint: {
          'line-color': '#00FF00',
          'line-width': 2
        }
      });
    };

    const handleMouseUp = (e) => {
      if (!isCurrentlyDrawing || !startPoint) return;
      
      const endPoint = [e.lngLat.lng, e.lngLat.lat];
      
      // Set selected area
      const area = {
        north: Math.max(startPoint[1], endPoint[1]),
        south: Math.min(startPoint[1], endPoint[1]),
        east: Math.max(startPoint[0], endPoint[0]),
        west: Math.min(startPoint[0], endPoint[0])
      };
      
      console.log('Area selected:', area);
      setSelectedArea(area);
      drawGrid(area, mapInstance);
      
      stopDrawing();
    };

    // Add event listeners
    mapInstance.on('mousedown', handleMouseDown);
    mapInstance.on('mousemove', handleMouseMove);
    mapInstance.on('mouseup', handleMouseUp);

    // Store cleanup function
    return () => {
      mapInstance.off('mousedown', handleMouseDown);
      mapInstance.off('mousemove', handleMouseMove);
      mapInstance.off('mouseup', handleMouseUp);
      if (controlGroup.parentNode) {
        controlGroup.parentNode.removeChild(controlGroup);
      }
    };
  }, [drawGrid, setIsDrawing, setSelectedArea]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapInstanceRef.current) return;

    try {
      const mapInstance = new Map({
        container: mapContainer.current,
        style: 'https://api.maptiler.com/maps/satellite/style.json?key=SgOq97w6pvP5GUqakLj6',
        center: center,
        zoom: 18,
      });

      mapInstanceRef.current = mapInstance;

      mapInstance.on('load', () => {
        console.log('Map loaded successfully');
        setMap(mapInstance);
        
        // Add drawing functionality
        const cleanup = setupDrawingControls(mapInstance);
        
        // Store cleanup function for later use
        mapInstance._drawingCleanup = cleanup;
      });

      mapInstance.on('error', (e) => {
        console.error('Map error:', e);
      });

    } catch (error) {
      console.error('Failed to initialize map:', error);
    }

    return () => {
      if (mapInstanceRef.current) {
        if (mapInstanceRef.current._drawingCleanup) {
          mapInstanceRef.current._drawingCleanup();
        }
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [setupDrawingControls]);

  // Handle drag functions (same as original)
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.pageX - cameraPosition.x,
      startY: e.pageY - cameraPosition.y
    };
    e.preventDefault();
    e.stopPropagation();
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;

    const newX = e.pageX - dragRef.current.startX;
    const newY = e.pageY - dragRef.current.startY;

    const mapContainer = document.querySelector('.map-wrapper');
    const cameraFeed = document.querySelector('.drone-camera-feed');

    if (mapContainer && cameraFeed) {
      const mapRect = mapContainer.getBoundingClientRect();
      const feedRect = cameraFeed.getBoundingClientRect();

      const maxX = mapRect.width - feedRect.width;
      const maxY = mapRect.height - feedRect.height;
      const minY = 70;

      setCameraPosition({
        x: Math.min(Math.max(0, newX), maxX),
        y: Math.min(Math.max(minY, newY), maxY)
      });
    }
  }, [isDragging]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove]);

  // Search functionality using OpenStreetMap Nominatim (free)
  const handleSearch = async (query) => {
    if (!query.trim()) return;
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      const data = await response.json();
      
      if (data.length > 0) {
        const { lat, lon } = data[0];
        const location = [parseFloat(lon), parseFloat(lat)];
        
        if (map) {
          map.flyTo({
            center: location,
            zoom: 15
          });
        }
        
        setSelectedLocation({ lat: parseFloat(lat), lng: parseFloat(lon) });
        setSearchTerm('');
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleSearchInputChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    handleSearch(searchTerm);
  };

  // Dispatch drone function (same as original)
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

  useImperativeHandle(ref, () => ({
    handleDispatchDrone: () => {
      if (selectedArea) {
        dispatchDroneToArea(selectedArea);
      } else {
        onDispatchDrone('Please select an area on the map first');
      }
    }
  }));

  return (
    <div className="map-wrapper">
      {/* Search input */}
      <form onSubmit={handleSearchSubmit}>
        <input
          ref={searchBoxRef}
          type="text"
          placeholder="Search a place"
          className="search-box"
          value={searchTerm}
          onChange={handleSearchInputChange}
        />
      </form>

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

      {/* MapLibre container */}
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
    </div>
  );
});

export default MapComponent;
