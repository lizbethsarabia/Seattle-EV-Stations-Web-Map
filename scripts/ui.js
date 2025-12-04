// UI helpers for navigation and search
function toggleNav() {
  var x = document.getElementById("myTopnav");
  if (!x) return;
  if (x.className === "topnav") {
    x.className += " responsive";
  } else {
    x.className = "topnav";
  }
}

// Search function to query EV stations and neighborhoods
function searchMap(query) {
  if (!query || query.trim() === '') return;
  
  var q = query.toLowerCase();
  var results = [];
  
  // Search EV stations
  if (window.evData && window.evData.features) {
    window.evData.features.forEach(function(feature) {
      var props = feature.properties || {};
      var station_name = (props.station_name || '').toLowerCase();
      var street = (props.street_address || '').toLowerCase();
      var city = (props.city || '').toLowerCase();
      var zip = (props.zip || '').toLowerCase();
      var network = (props.ev_network || '').toLowerCase();
      
      if (station_name.includes(q) || street.includes(q) || city.includes(q) || zip.includes(q) || network.includes(q)) {
        results.push({
          type: 'station',
          name: props.station_name,
          address: props.street_address + ', ' + props.city + ', ' + props.state + ' ' + props.zip,
          coordinates: feature.geometry.coordinates
        });
      }
    });
  }
  
  // Search neighborhoods
  if (window.neighborhoodsData && window.neighborhoodsData.features) {
    window.neighborhoodsData.features.forEach(function(feature) {
      var props = feature.properties || {};
      var l_hood = (props.L_HOOD || '').toLowerCase();
      var s_hood = (props.S_HOOD || '').toLowerCase();
      
      if (l_hood.includes(q) || s_hood.includes(q)) {
        // Get centroid of the neighborhood polygon for zoom
        var coords = feature.geometry.coordinates[0][0] || [-122.33, 47.6];
        results.push({
          type: 'neighborhood',
          name: props.S_HOOD + ', ' + props.L_HOOD,
          coordinates: coords
        });
      }
    });
  }
  
  // If results found, fly to the first one
  if (results.length > 0) {
    var result = results[0];
    var coords = result.coordinates;
    console.log('Search result:', result);
    
    if (window.map) {
      // Fly to the feature
      window.map.flyTo({
        center: [coords[0], coords[1]],
        zoom: result.type === 'station' ? 15 : 12,
        duration: 1500
      });
      
      // Add a popup at the location after animation completes
      setTimeout(function() {
        var popupContent = '<strong>' + result.name + '</strong>';
        if (result.address) {
          popupContent += '<br>' + result.address;
        }
        
        new mapboxgl.Popup({ closeButton: true, closeOnClick: true })
          .setLngLat(coords)
          .setHTML(popupContent)
          .addTo(window.map);
      }, 1500);
    }
    
    // Show results count in console
    console.log('Found ' + results.length + ' result(s)');
  } else {
    alert('No results found for "' + query + '"');
  }
}

// Clear search function
function clearSearch() {
  var searchInput = document.getElementById('nav-search');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  
  // Close any open popups
  if (window.map) {
    var popups = document.querySelectorAll('.mapboxgl-popup');
    popups.forEach(function(popup) {
      popup.remove();
    });
  }
  
  console.log('Search cleared');
}

// Go to Top button logic
var myBtn = null;
window.addEventListener('DOMContentLoaded', function() {
  myBtn = document.getElementById('myBtn');
  window.onscroll = function() { scrollFunction(); };
  // wire up search form if present
  var f = document.getElementById('nav-search-form');
  if (f) {
    f.addEventListener('submit', function(evt) {
      evt.preventDefault();
      var q = (document.getElementById('nav-search')||{}).value || '';
      searchMap(q);
    });
  }
});

function scrollFunction() {
  if (!myBtn) return;
  if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
    myBtn.style.display = "block";
  } else {
    myBtn.style.display = "none";
  }
}

function topFunction() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


//Liz adding filters below
function getFilters() {
    return {
        level: document.getElementById('filter-level')?.value || '',
        type: document.getElementById('filter-type')?.value || '',
        network: document.getElementById('filter-network')?.value || '',
        neighborhood: document.getElementById('filter-neighborhood')?.value || ''
    };
}

// Proximity Search Feature
function searchByProximity() {
  if (!window.evData || !window.map) {
    alert('Map data not yet loaded');
    return;
  }

  // Get user's current location
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  var radiusInput = document.getElementById('proximity-radius');
  var radius = parseFloat(radiusInput?.value || 1);
  if (isNaN(radius) || radius <= 0) {
    alert('Please enter a valid search radius (miles)');
    return;
  }

  var statusDiv = document.getElementById('proximity-status');
  statusDiv.textContent = 'Locating your position...';
  statusDiv.style.color = '#666';

  navigator.geolocation.getCurrentPosition(
    function(position) {
      var userLat = position.coords.latitude;
      var userLon = position.coords.longitude;
      var userPoint = turf.point([userLon, userLat]);

      // Find all stations within radius
      var nearbyStations = window.evData.features.filter(function(feature) {
        var stationPoint = turf.point(feature.geometry.coordinates);
        var distance = turf.distance(userPoint, stationPoint, { units: 'miles' });
        return distance <= radius;
      });

      if (nearbyStations.length === 0) {
        statusDiv.textContent = 'No stations within ' + radius + ' miles.';
        statusDiv.style.color = '#d32f2f';
        return;
      }

      // Update map with nearby stations only
      var nearbyData = { type: 'FeatureCollection', features: nearbyStations };
      var source = window.map.getSource('evData');
      if (source) {
        source.setData(nearbyData);
      }

      // Add user location marker
      addUserLocationMarker(userLon, userLat);

      // Zoom to fit user and nearby stations
      var bbox = turf.bbox(nearbyData);
      window.map.fitBounds(bbox, { padding: 50, duration: 1000 });

      statusDiv.textContent = 'Found ' + nearbyStations.length + ' station(s) within ' + radius + ' mile(s).';
      statusDiv.style.color = '#2e7d32';
    },
    function(error) {
      console.warn('Geolocation error:', error);
      statusDiv.textContent = 'Unable to get your location: ' + error.message;
      statusDiv.style.color = '#d32f2f';
    }
  );
}

// Add a marker for user's current location
function addUserLocationMarker(lng, lat) {
  // Remove existing user marker if present
  var existingMarker = document.getElementById('user-location-marker');
  if (existingMarker) {
    existingMarker.remove();
  }

  var el = document.createElement('div');
  el.id = 'user-location-marker';
  el.style.width = '20px';
  el.style.height = '20px';
  el.style.backgroundColor = '#4285F4';
  el.style.borderRadius = '50%';
  el.style.border = '3px solid white';
  el.style.boxShadow = '0 0 10px rgba(66, 133, 244, 0.5)';
  el.style.cursor = 'pointer';

  new mapboxgl.Marker(el)
    .setLngLat([lng, lat])
    .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML('<strong>Your Location</strong>'))
    .addTo(window.map);
}

// Clear proximity search and restore all stations
function clearProximitySearch() {
  if (!window.evData || !window.map) return;

  // Restore full dataset
  var source = window.map.getSource('evData');
  if (source) {
    source.setData(window.evData);
  }

  // Remove user location marker
  var existingMarker = document.getElementById('user-location-marker');
  if (existingMarker) {
    existingMarker.remove();
  }

  // Reset status
  var statusDiv = document.getElementById('proximity-status');
  statusDiv.textContent = '';

  // Fly back to original view
  window.map.flyTo({
    center: [-122.335, 47.623],
    zoom: 10.5,
    duration: 1500
  });

  console.log('Proximity search cleared');
}

// Wire up proximity search buttons after DOM loads
window.addEventListener('DOMContentLoaded', function() {
  var proximityBtn = document.getElementById('proximity-search-btn');
  var clearProximityBtn = document.getElementById('proximity-clear-btn');

  if (proximityBtn) {
    proximityBtn.addEventListener('click', searchByProximity);
  }

  if (clearProximityBtn) {
    clearProximityBtn.addEventListener('click', clearProximitySearch);
  }
});

