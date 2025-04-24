import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'; // Import CircleMarker
import L from 'leaflet'; // Import Leaflet library
import './App.css';
import SafetyInfo from './components/SafetyInfo'; // Import SafetyInfo component
// Removed WhistleOverlay import
import DataSourceSelector from './components/DataSourceSelector'; // Import DataSourceSelector

// Define magnitude ranges
const MAGNITUDE_RANGES = {
  '0-2': { min: 0, max: 2 },
  '2-4': { min: 2, max: 4 },
  '4-6': { min: 4, max: 6 },
  '6+': { min: 6, max: 9 }, // Assuming 10 as a practical upper bound
  'all': { min: 0, max: 9 },
};

function App() {
  const [userLocation, setUserLocation] = useState(null); // [latitude, longitude]
  const [earthquakes, setEarthquakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInEmergencyMode, setIsInEmergencyMode] = useState(false); // State for emergency banner visibility
  const [lastAlarmTriggeredQuakeId, setLastAlarmTriggeredQuakeId] = useState(null); // Track the last quake ID that triggered alarm
  const [showSafetyInfo, setShowSafetyInfo] = useState(false); // State for safety info overlay
  const availableSources = ['USGS', 'Kandilli', 'EMSC']; // Define available sources first
  // State for data source, loaded from localStorage
  const [dataSource, setDataSource] = useState(() => {
    const savedSource = localStorage.getItem('dataSource');
    // Check if the saved source is valid and available in the current list
    if (savedSource && availableSources.includes(savedSource)) {
      return savedSource;
    }
    return 'USGS'; // Default to USGS if saved source is invalid or not found
  });
  // const [prevDataSource, setPrevDataSource] = useState(dataSource); // Removed: No longer needed to track previous data source

  // State for magnitude range filter, loaded from localStorage
  const [magnitudeRange, setMagnitudeRange] = useState(() => {
  const savedRange = localStorage.getItem('magnitudeRange');
  return savedRange !== null && MAGNITUDE_RANGES[savedRange] ? savedRange : 'all';
  });
  // Removed selectedCountry state
  // Removed whistle state
  const { t } = useTranslation(); // i18n hook
  const [isTestAlarmPlaying, setIsTestAlarmPlaying] = useState(false);
  const alarmAudioRef = useRef(null);
  const previousEarthquakesRef = useRef([]); // Ref to store previous earthquake IDs for comparison

  // Effect for theme removed.

  useEffect(() => {
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (err) => {
          console.error("Error getting location: ", err);
          setError(t('locationError'));
          setUserLocation([39.9334, 32.8597]); // Ankara as default
        }
      );
    } else {
      setError(t('geolocationNotSupported'));
      setUserLocation([39.9334, 32.8597]); // Ankara as default
    }
  }, [t]);

  // Haversine formula to calculate distance between two lat/lng points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;  // Convert degrees to radians
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

// Function to get marker style based on magnitude (for CircleMarker)
const getCircleMarkerStyle = (magnitude) => {
  let color = 'var(--marker-color-low)'; // Use CSS variables for theme compatibility
  let radius = 6;

  if (magnitude < 3.0) {
    color = 'var(--marker-color-low)';
    radius = 6;
  } else if (magnitude >= 3.0 && magnitude < 5.0) {
    color = 'var(--marker-color-medium)';
    radius = 8;
  } else { // magnitude >= 5.0
    color = 'var(--marker-color-high)';
    radius = 10;
  }

  return {
    color: color,
    fillColor: color,
    fillOpacity: 0.7,
    radius: radius,
    weight: 1 // border weight
  };
};

// Fetch earthquake data based on the selected source
  useEffect(() => {
    // Removed logic that reset previousEarthquakesRef on dataSource change
    // if (dataSource !== prevDataSource) {
    //   console.log(`Data source changed from ${prevDataSource} to ${dataSource}. Resetting previous earthquakes ref.`);
    //   previousEarthquakesRef.current = [];
    //   setPrevDataSource(dataSource); // Update previous data source tracker
    // }

    const fetchEarthquakes = async (selectedSource) => {
      // API URLs - Add others as implemented
      const API_URLS = {
        USGS: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
        // Using a third-party wrapper for Kandilli as official source is text-based
        Kandilli: 'https://api.orhanaydogdu.com.tr/deprem/kandilli/live?limit=20',
        // EMSC FDSN web service, filtered approximately for Turkey
        EMSC: 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=100&orderby=time&minlat=35.5&maxlat=42.5&minlon=25.5&maxlon=45.0',
        // AFAD entry removed
      };

      const apiUrl = API_URLS[selectedSource];
      if (!apiUrl) {
        console.error(`API URL for source ${selectedSource} not defined.`);
        setError(t('errorApiUrlMissing', { source: selectedSource }));
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        console.log(`Fetching data from ${selectedSource}: ${apiUrl}`);
        const response = await axios.get(apiUrl);
        console.log(`Raw data from ${selectedSource}:`, response.data);

        let processedEarthquakes = [];

        // --- Data Processing Logic (Needs specific implementation for each source) ---
        if (selectedSource === 'USGS') {
          const features = response.data.features || [];
          processedEarthquakes = features
            .filter(quake => quake.properties.place && quake.properties.place.toLowerCase().includes('turkey')) // Filter for Turkey
            .map(quake => ({ // Standardize format
              id: quake.id,
              mag: quake.properties.mag,
              place: quake.properties.place,
              time: quake.properties.time,
              depth: quake.geometry.coordinates[2],
              lat: quake.geometry.coordinates[1],
              lon: quake.geometry.coordinates[0],
              source: 'USGS'
            }))
            .slice(0, 20); // Limit to last 20
        } else if (selectedSource === 'Kandilli') {
          // --- Kandilli Specific Processing (using api.orhanaydogdu.com.tr) ---
          const results = response.data.result || [];
          processedEarthquakes = results.map(quake => ({
            id: quake.earthquake_id || `${quake.lat}-${quake.lng}-${quake.date}`, // Create a unique ID if missing
            mag: parseFloat(quake.mag) || 0,
            place: quake.title,
            time: new Date(quake.date).getTime(), // Convert date string to timestamp
            depth: parseFloat(quake.depth) || 0,
            lat: parseFloat(quake.lat) || 0,
            lon: parseFloat(quake.lng) || 0,
            source: 'Kandilli'
          }))
          .filter(quake => // Add geographic filter for Turkey
            quake.lat >= 35.5 && quake.lat <= 42.5 &&
            quake.lon >= 25.5 && quake.lon <= 45.0
          )
          .slice(0, 20); // Already limited by API, but good practice
          // --- End Kandilli Specific Processing ---
        } else if (selectedSource === 'EMSC') {
          // --- EMSC Specific Processing (GeoJSON format) ---
          const features = response.data.features || [];
          processedEarthquakes = features
            // API query already filters geographically, but we double-check
            // .filter(quake => quake.properties.flynn_region && quake.properties.flynn_region.toLowerCase().includes('turkey')) // Optional stricter filter
            .map(quake => ({
              id: quake.id,
              mag: parseFloat(quake.properties.mag) || 0,
              place: quake.properties.flynn_region || 'Unknown Location',
              time: quake.properties.time, // Already a timestamp
              depth: parseFloat(quake.geometry.coordinates[2]) / 1000 || 0, // Depth is in meters, convert to km
              lat: quake.geometry.coordinates[1],
              lon: quake.geometry.coordinates[0],
              source: 'EMSC'
            }))
            .slice(0, 20); // Limit to 20 most recent from the filtered results
          // --- End EMSC Specific Processing ---
        } else {
          // Fallback for any unexpected source (AFAD logic removed)
          console.error(`Unknown data source selected: ${selectedSource}`);
          processedEarthquakes = [];
        }
        // --- End Data Processing Logic ---

        console.log(`Processed ${selectedSource} Earthquakes (Turkey, max 20):`, processedEarthquakes);
        setEarthquakes(processedEarthquakes);

        // --- Revised Alert Logic ---
        if (userLocation && processedEarthquakes.length > 0) {
          const alertMagnitudeThreshold = 4.0;
          const alertDistanceThreshold = 50; // km

          // 1. Identify ALL significant quakes in the current data
          const allSignificantQuakes = processedEarthquakes.filter(quake => {
            const distance = calculateDistance(userLocation[0], userLocation[1], quake.lat, quake.lon);
            return distance <= alertDistanceThreshold && quake.mag >= alertMagnitudeThreshold;
          });
          console.log(`Found ${allSignificantQuakes.length} significant quakes in current ${selectedSource} data.`);

          // 2. Identify NEW significant quakes compared to the previous fetch
          const previousQuakeIds = new Set(previousEarthquakesRef.current.map(q => q.id));
          const newSignificantQuakes = allSignificantQuakes.filter(quake => !previousQuakeIds.has(quake.id));
          console.log(`Found ${newSignificantQuakes.length} *new* significant quakes.`);

          // 3. Manage Emergency Banner Visibility
          if (allSignificantQuakes.length > 0) {
            if (!isInEmergencyMode) {
              console.log(`Significant quake(s) detected in ${selectedSource}. Activating Emergency Banner.`);
              setIsInEmergencyMode(true); // Controls banner visibility
            }
          } else {
            if (isInEmergencyMode) {
              console.log(`No significant quakes detected in ${selectedSource}. Deactivating Emergency Banner.`);
              setIsInEmergencyMode(false); // Controls banner visibility
            }
          }

          // 4. Trigger Alarm & Notification for NEW significant quakes
          if (newSignificantQuakes.length > 0) {
            const mostSignificantNewQuake = newSignificantQuakes.sort((a, b) => b.mag - a.mag)[0];
            const { place, mag, id } = mostSignificantNewQuake;

            // Trigger Alarm (Sound/Vibration) only if it's a different quake than the last one that triggered the alarm
            if (id !== lastAlarmTriggeredQuakeId) {
              console.warn(`NEW Significant Quake Detected: ${place} (Mag: ${mag}). Triggering Alarm.`);
              setLastAlarmTriggeredQuakeId(id); // Update the state with the ID of the quake that triggered the alarm

              // Play Alarm Sound
              const alarmSound = new Audio('/alarm.mp3');
              alarmSound.play().catch(e => console.error('Error playing emergency sound:', e));

              // Vibrate
              if ('vibrate' in navigator) {
                console.log("Emergency Alarm - Vibrating");
                navigator.vibrate([1000, 500, 1000, 500, 1000]);
              }
            } else {
                 console.log(`Significant quake ${id} re-detected, but alarm already triggered for it. Skipping sound/vibration.`);
            }

            // Send Notification (always send for new significant quakes, tag handles duplicates)
            console.log(`Sending notification for new significant quake: ${place} (Mag: ${mag})`);
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(t('alertTitle', 'Earthquake Alert!'), {
                    body: t('alertBody', `Significant earthquake detected near you: ${place} (Mag: ${mag})`, { place: place, mag: mag }),
                    icon: '/pwa-192x192.png',
                    tag: `earthquake-alert-${id}`
                });
            } else if ('Notification' in window && Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification(t('alertTitle', 'Earthquake Alert!'), {
                            body: t('alertBody', `Significant earthquake detected near you: ${place} (Mag: ${mag})`, { place: place, mag: mag }),
                            icon: '/pwa-192x192.png',
                            tag: `earthquake-alert-${id}`
                        });
                    }
                });
            }
          }

          // 5. Update the ref with the current list of earthquakes for the next comparison
          previousEarthquakesRef.current = processedEarthquakes.map(q => ({ id: q.id }));

        } else {
            // If user location is not available OR no earthquakes were processed,
            // ensure banner is off.
            if (isInEmergencyMode) {
                setIsInEmergencyMode(false);
                console.log('Emergency banner deactivated due to lack of location or earthquake data.');
            }
            // Consider if resetting lastAlarmTriggeredQuakeId here is necessary. 
            // Maybe not, as a new quake would have a different ID anyway.
        }
        // --- End Revised Alert Logic ---

        setError(null); // Clear previous errors
      } catch (err) {
        console.error("Error fetching earthquake data: ", err);
        // Enhanced error logging
        if (err.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('Error Response Data:', err.response.data);
          console.error('Error Response Status:', err.response.status);
          console.error('Error Response Headers:', err.response.headers);
        } else if (err.request) {
          // The request was made but no response was received
          // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
          // http.ClientRequest in node.js
          console.error('Error Request:', err.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.error('Error Message:', err.message);
        }
        console.error('Error Config:', err.config);

        setError(t('fetchErrorSource', { source: selectedSource, message: err.message })); // Use specific error message
        setEarthquakes([]); // Clear existing earthquake data on error
      } finally {
        setLoading(false);
      }
    };

    fetchEarthquakes(dataSource); // Fetch immediately with current source
    const intervalId = setInterval(() => fetchEarthquakes(dataSource), 5 * 60 * 1000); // Fetch periodically

    return () => {
      clearInterval(intervalId);
    };

  // Dependencies: userLocation, t, dataSource, isInEmergencyMode, lastAlarmTriggeredQuakeId
  // Added lastAlarmTriggeredQuakeId to ensure alarm logic runs correctly when it changes.
  }, [userLocation, t, dataSource, isInEmergencyMode, lastAlarmTriggeredQuakeId]);

  // Cleanup effect for alarm sound
  useEffect(() => {
    // Return a cleanup function
    return () => {
      if (alarmAudioRef.current) {
        alarmAudioRef.current.pause();
        alarmAudioRef.current.currentTime = 0; // Reset time
        alarmAudioRef.current = null; // Clean up ref
        console.log('Alarm audio cleaned up.');
      }
    };
  }, []); // Empty dependency array ensures this runs only on unmount

  // Removed useEffect for playing sound/vibrating based on isInEmergencyMode change

  // Effect to save magnitudeRange to localStorage
  useEffect(() => {
    localStorage.setItem('magnitudeRange', magnitudeRange);
  }, [magnitudeRange]);

  // Effect to save dataSource to localStorage
  useEffect(() => {
    localStorage.setItem('dataSource', dataSource);
  }, [dataSource]);

  // Removed effect for selectedCountry

  if (loading) {
    return <div>{t('loadingMapAndLocation')}</div>;
  }

  if (error) {
    return <div>{t('errorPrefix')} {error}</div>;
  }

  const handleTestAlarm = () => {
    if (isTestAlarmPlaying) {
      // Stop the alarm
      console.log('Stopping Test Alarm...');
      if (alarmAudioRef.current) {
        alarmAudioRef.current.pause();
        alarmAudioRef.current.loop = false;
        alarmAudioRef.current.currentTime = 0; // Reset playback position
      }
      // Stop vibration (Note: Vibration API doesn't have a direct stop, setting to 0 or [] might work or just let it finish)
      if ('vibrate' in navigator) {
        navigator.vibrate(0);
      }
      setIsTestAlarmPlaying(false);
    } else {
      // Start the alarm
      console.log('Starting Test Alarm...');
      if (!alarmAudioRef.current) {
        alarmAudioRef.current = new Audio('/alarm.mp3');
      }
      alarmAudioRef.current.loop = true;
      alarmAudioRef.current.play().catch(e => console.error('Error playing test alarm sound:', e));

      // Vibrate
      if ('vibrate' in navigator) {
        // Use a pattern that repeats or a long vibration
        navigator.vibrate([1000, 500, 1000, 500, 1000, 500, 1000]); // Example repeating pattern
      }

      // Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(t('testAlarmTitle', 'Test Alarm!'), {
          body: t('testAlarmBody', 'This is a test of the earthquake alarm notification.'),
          icon: '/pwa-192x192.png',
          tag: 'test-alarm' // Use a tag to potentially replace existing notification
        });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification(t('testAlarmTitle', 'Test Alarm!'), {
              body: t('testAlarmBody', 'This is a test of the earthquake alarm notification.'),
              icon: '/pwa-192x192.png',
              tag: 'test-alarm'
            });
          }
        });
      }
      setIsTestAlarmPlaying(true);
    }
  };

  const handleShowSafetyInfo = () => {
    setShowSafetyInfo(true);
  };

  const handleCloseSafetyInfo = () => {
    setShowSafetyInfo(false);
  };

  // Filter earthquakes based on selected magnitude range for display
  // Earthquakes state already contains filtered-by-Turkey and limited-to-20 data from the selected source
  const filteredEarthquakes = earthquakes.filter(quake => {
    const { mag } = quake; // Use standardized format
    const range = MAGNITUDE_RANGES[magnitudeRange];
    return mag >= range.min && mag < range.max;
  });

  return (
    // Apply dark theme styles via CSS directly
    <div className={`App ${isInEmergencyMode ? 'emergency-mode' : ''}`}>
      {isInEmergencyMode && <div className="emergency-banner">{t('emergencyBanner')}</div>}
      <div className="header-controls">
        <h1>{t('appTitle')}</h1>
        <div className="data-source-display">
          {t('dataSourceLabel', 'Data Source')}: <strong>{dataSource}</strong>
        </div>
      </div>

      {userLocation && (
        <MapContainer center={userLocation} zoom={6} scrollWheelZoom={true} style={{ height: '400px', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={userLocation}>
            <Popup>
              {t('popupYouAreHere')}
            </Popup>
          </Marker>
          {/* Earthquake Markers - Use filteredEarthquakes */}
          {filteredEarthquakes.map(quake => {
            const { lat, lon, mag, place, time, depth } = quake; // Use standardized format
            const position = [lat, lon]; // Leaflet uses [lat, lng]

            // Distance filter (optional - maybe remove if only showing Turkey?)
            const distance = calculateDistance(userLocation[0], userLocation[1], lat, lon);

            const markerStyle = getCircleMarkerStyle(mag);

            return (
              <CircleMarker key={quake.id} center={position} pathOptions={markerStyle}>
                <Popup>
                  <b>{place}</b><br />
                  {t('popupMagnitude')} {mag}<br />
                  {t('popupTime')} {new Date(time).toLocaleString()}<br />
                  {t('popupDepth')} {depth} km
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      )}
      <p>{t('yourLocation')} {userLocation ? `${userLocation[0].toFixed(4)}, ${userLocation[1].toFixed(4)}` : t('gettingLocation')}</p>

      {/* Action Buttons */}
      <div className="action-buttons">
        <button onClick={handleTestAlarm}>
          {isTestAlarmPlaying
            ? t('stopTestAlarmButtonLabel', 'Stop Test Alarm')
            : t('testAlarmButtonLabel', 'Test Alarm')}
        </button>
        <button onClick={handleShowSafetyInfo}>
          {t('safetyInfoTitle', 'Safety Info')}
        </button>
      </div>

      {/* Filter Controls Container */}
      <div className="filters-area">
        {/* Data Source Selector */}
        <DataSourceSelector
          availableSources={availableSources}
          selectedSource={dataSource}
          onSourceChange={setDataSource} // Pass the state setter function
        />

        {/* Magnitude Filter */}
        <div className="filter-container magnitude-filter">
          <label>{t('magnitudeFilterLabel', 'Filter by Magnitude')}:</label>
          <div className="magnitude-buttons">
            {Object.keys(MAGNITUDE_RANGES).map(rangeKey => (
              <button
                key={rangeKey}
                className={magnitudeRange === rangeKey ? 'active' : ''}
                onClick={() => setMagnitudeRange(rangeKey)}
              >
                {rangeKey === 'all' ? t('magnitudeAll', 'All') : rangeKey}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Removed Country Filter */}

      {/* Recent Earthquakes List - Use filteredEarthquakes */}
      <div className="earthquake-list-container">
        <h2>{t('recentEarthquakesTitle', 'Recent Earthquakes in Turkey ({{source}}, Max 20)', { source: dataSource })}</h2>
        {filteredEarthquakes.length > 0 ? (
          <ul className="earthquake-list">
            {filteredEarthquakes.map(quake => {
              const { lat, lon, mag, place, time } = quake; // Use standardized format
              const distance = userLocation ? calculateDistance(userLocation[0], userLocation[1], lat, lon) : null;
              // No need for country or magnitude filter here, already done
              return (
                <li key={quake.id} className="earthquake-list-item">
                  <strong>{place || t('unknownLocation', 'Unknown Location')}</strong><br />
                  <span>{t('popupMagnitude')} {mag}</span> | <span>{t('popupTime')} {new Date(time).toLocaleString()}</span>
                  {distance !== null && <span> | {t('distanceLabel', 'Distance')}: {distance.toFixed(1)} km</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>{t('noRecentEarthquakes', 'No recent earthquakes matching filters for {{source}} in Turkey.', { source: dataSource })}</p>
        )}
      </div>

      {/* Safety Info Overlay */}
      {showSafetyInfo && <SafetyInfo onClose={handleCloseSafetyInfo} />}
      {/* Removed WhistleOverlay component usage */}
    </div>
  );
}

export default App;
