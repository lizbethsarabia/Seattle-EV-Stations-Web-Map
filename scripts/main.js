// Main JS for Seattle EV Stations Map
// Assumes Mapbox GL JS and Turf are already loaded in the page (included in head of index.html)

// Brandon's Mapbox Token (joogleberry)
mapboxgl.accessToken = 'pk.eyJ1Ijoiam9vZ2xlYmVycnkiLCJhIjoiY202YjZqcHp3MDVjeDJqbzg5MTgwMng1ZSJ9.SYbn23E8INsag4nFhp7VDA';

const map = new mapboxgl.Map({
    container: 'map',
    //style: 'mapbox://styles/joogleberry/cmip84zdn002k01ssamty38p5',
    style: 'mapbox://styles/mapbox/streets-v8',
    center: [-122.335, 47.623],
    zoom: 10.5
});

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

    // Expose data globally for search functionality
    window.evData = evData;
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

/* End of main.js */
