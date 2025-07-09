import React from 'react';
import './CameraFeed.css';

const CameraFeed = () => {
  return (
    <div className="fullscreen-camera-feed">
      <div className="camera-header">
        <div className="camera-title">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          Drone Camera Feed
          <div className="live-indicator">
            <div className="live-dot"></div>
            LIVE
          </div>
        </div>
        <button 
          className="close-button"
          onClick={() => window.close()}
          title="Close fullscreen"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div className="camera-feed-content">
    <img 
        src="http://127.0.0.1:5001/video-feed" 
        alt="Drone Camera Feed" 
        className="live-feed" 
    />
</div>
    </div>
  );
};

export default CameraFeed;