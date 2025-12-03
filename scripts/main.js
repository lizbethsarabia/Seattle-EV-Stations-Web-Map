// Main JS for Seattle EV Stations Map
// Assumes Mapbox GL JS and Turf are already loaded in the page (included in head of index.html)

// Brandon's Mapbox Token (joogleberry)
mapboxgl.accessToken = 'pk.eyJ1Ijoiam9vZ2xlYmVycnkiLCJhIjoiY202YjZqcHp3MDVjeDJqbzg5MTgwMng1ZSJ9.SYbn23E8INsag4nFhp7VDA';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v8',
    
    //style: 'assets/style.json',
    //style: 'mapbox://styles/joogleberry/cmip84zdn002k01ssamty38p5',
    center: [-122.335, 47.623],
    zoom: 10.5
});
map.addControl(new mapboxgl.NavigationControl(), 'bottom-left'); // Add zoom and compass controls


// Expose map globally for search functionality
window.map = map;

// Load data and add as layer
async function geojsonFetch() {
    // Fetch neighborhoods GeoJSON
    let neighborhoodsRes = await fetch('assets/neighborhoods_clean.geojson');
    let neighborhoodsData = await neighborhoodsRes.json();

    // Fetch EV stations GeoJSON
    let evRes = await fetch('assets/seattle_ev_cleaned_clean.geojson');
    let evData = await evRes.json();

    // Filter EV points to only those within the neighborhoods using Turf
    /* Some points from the geojson lie outside the neighborhood polygons */
    let filteredEvData = evData;
    try {
        filteredEvData = turf.pointsWithinPolygon(evData, neighborhoodsData);
    } catch (err) {
        // fallback: if turf.pointsWithinPolygon isn't available for some reason
        if (typeof turf !== 'undefined' && turf.booleanPointInPolygon) {
            const inside = evData.features.filter(pt => {
                return neighborhoodsData.features.some(poly => turf.booleanPointInPolygon(pt, poly));
            });
            filteredEvData = { type: 'FeatureCollection', features: inside };
        }
    }

    // Liz: Add neighborhood property to each EV station for filtering
    filteredEvData.features.forEach(station => {
        const poly = neighborhoodsData.features.find(n => turf.booleanPointInPolygon(station, n));
        station.properties.neighborhood = poly ? poly.properties.L_HOOD : null;
    });

    // Expose data globally for search functionality
    window.filteredEvData = filteredEvData;
    window.neighborhoodsData = neighborhoodsData;

    map.on('load', function loadingData() {

        // Add neighborhoods layer and source
        map.addSource('neighborhoodsData', {
            type: 'geojson',
            data: neighborhoodsData
        });

        map.addLayer({
            'id': 'neighborhoods-layer',
            'type': 'fill',
            'source': 'neighborhoodsData',
            'layout': {},
            'paint': {
                'fill-color': '#888888',
                'fill-opacity': 0.3,
                'fill-outline-color': '#000000'
            }
        });

        /* Each 'station' is an individual point in the geojson, but clusters will group them visually */
        // Add EV stations geojson source with clustering enabled
        map.addSource('evData', {
            type: 'geojson',
            data: filteredEvData,
            cluster: true,
            clusterMaxZoom: 18,
            clusterRadius: 50
        });

        // Load custom icon for EV charging stations
        map.loadImage('images/charging-station.png', function (error, image) {
            if (error || !image) {
                console.warn('Charging station icon not found, using circle-based clusters.', error);

                // Cluster circles
                map.addLayer({
                    id: 'clusters',
                    type: 'circle',
                    source: 'evData',
                    filter: ['has', 'point_count'],
                    paint: {
                        'circle-color': '#FF8C00',
                        'circle-radius': [
                            'step',
                            ['get', 'point_count'],
                            15,
                            10, 20,
                            50, 30
                        ],
                        'circle-opacity': 0.8
                    }
                });

                // Cluster count labels
                map.addLayer({
                    id: 'cluster-count',
                    type: 'symbol',
                    source: 'evData',
                    filter: ['has', 'point_count'],
                    layout: {
                        'text-field': '{point_count_abbreviated}',
                        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                        'text-size': 13.7,
                        'text-anchor': 'top',
                        'text-offset': [0, 0.6],
                        'text-allow-overlap': true
                    },
                    paint: {
                        'text-color': 'black',
                        'text-halo-color': 'white',
                        'text-halo-width': 2,
                        'text-halo-blur': 0.5
                    }
                });

                // Unclustered single points (circle)
                map.addLayer({
                    id: 'unclustered-point',
                    type: 'circle',
                    source: 'evData',
                    filter: ['!', ['has', 'point_count']],
                    paint: {
                        'circle-color': '#FF0000',
                        'circle-radius': 6
                    }
                });

                return;
            }

            // Add the icon image and use symbol layers for clusters and single points
            map.addImage('charging-station', image, { sdf: false });

            // Cluster: show single charging-station icon for clustered groups
            map.addLayer({
                id: 'cluster-symbol',
                type: 'symbol',
                source: 'evData',
                filter: ['has', 'point_count'],
                layout: {
                    'icon-image': 'charging-station',
                    'icon-size': 0.2,
                    'icon-allow-overlap': true,
                    'icon-ignore-placement': true
                }
            });

            // Cluster count text on top of cluster icon (positioned below icon)
            map.addLayer({
                id: 'cluster-count',
                type: 'symbol',
                source: 'evData',
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': '{point_count_abbreviated}',
                    'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                    'text-size': 12,
                    'text-anchor': 'top',
                    'text-offset': [0, 0.6],
                    'text-allow-overlap': true
                },
                paint: {
                    'text-color': '#FFFFFF',
                    'text-halo-color': '#f94b4a',
                    'text-halo-width': 2,
                    'text-halo-blur': 0.5
                }
            });

            // Unclustered single-point icons
            map.addLayer({
                id: 'unclustered-point',
                type: 'symbol',
                source: 'evData',
                filter: ['!', ['has', 'point_count']],
                layout: {
                    'icon-image': 'charging-station',
                    'icon-size': 0.2,
                    'icon-allow-overlap': true
                }
            });
        });
    });
}

// Call the function after map initialization
geojsonFetch();

//liz trying to add filtering function
// Apply filters to EV stations
function applyFilters() {
    if (!window.evData || !window.map) return;

    const filters = getFilters();

    // Filter EV features
    const filteredFeatures = window.evData.features.filter(feature => {
        const props = feature.properties || {};

        // Connector Level
        if (filters.level) {
            if (filters.level === '1' && (!props.ev_level1_evse_num || props.ev_level1_evse_num === 0)) return false;
            if (filters.level === '2' && (!props.ev_level2_evse_num || props.ev_level2_evse_num === 0)) return false;
            if (filters.level === 'dc_fast' && (!props.ev_dc_fast_count || props.ev_dc_fast_count === 0)) return false;
        }

        // Connector Type
        if (filters.type) {
            const types = (props.ev_connector_types || '').toLowerCase().split(',').map(s => s.trim());
            if (!types.includes(filters.type.toLowerCase())) return false;
        }

        // Network
        if (filters.network && props.ev_network !== filters.network) return false;

        // Neighborhood
        if (filters.neighborhood) {
            if ((props.neighborhood || '').toLowerCase() !== filters.neighborhood.toLowerCase()) return false;
        }

        return true;
    });

    const filteredData = { type: 'FeatureCollection', features: filteredFeatures };

    // Update map source
    const source = map.getSource('evData');
    if (source) {
        source.setData(filteredData);
    }

    // Fly to neighborhood if selected
    if (filters.neighborhood) {
        const hoodFeature = window.neighborhoodsData.features.find(f =>
            (f.properties.L_HOOD || '').toLowerCase() === filters.neighborhood.toLowerCase()
        );

        if (hoodFeature) {
            const center = turf.centroid(hoodFeature).geometry.coordinates;
            map.flyTo({ center, zoom: 13, duration: 1500 });
        }
    }
}



// Wire Apply/Reset buttons after DOM loads
window.addEventListener('DOMContentLoaded', function () {
    const applyBtn = document.getElementById('apply-filters-btn');
    const resetBtn = document.getElementById('reset-filters-btn');

    if (applyBtn) applyBtn.addEventListener('click', applyFilters);

    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            if (window.evData && map.getSource('evData')) {
                // Reset the map data
                map.getSource('evData').setData(window.evData);
            }

            // Reset UI dropdowns
            const selects = document.querySelectorAll('.filter-select');
            selects.forEach(s => s.value = '');

            // Fly back to original map position
            map.flyTo({
                center: [-122.335, 47.623],
                zoom: 10.5,
                duration: 1500
            });
        });
    }
});