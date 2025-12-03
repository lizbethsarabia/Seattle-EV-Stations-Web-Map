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
