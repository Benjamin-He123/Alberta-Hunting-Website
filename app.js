// =====================================================
// Map setup
// =====================================================

const map = L.map("map").setView([54.5, -115.0], 6);

const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxZoom: 19
    }
);

// Attribution for the Alberta Government datasets (WMU, Crown Land, Parks,
// First Nations Reserves, Metis Settlements) — required under the
// Open Government Licence - Alberta: https://open.alberta.ca/licence
map.attributionControl.addAttribution(
    'Contains information licensed under the <a href="https://open.alberta.ca/licence" target="_blank" rel="noopener">Open Government Licence &ndash; Alberta</a>'
);

// Custom icon for user-added (click) markers, distinct from the
// "your location" marker added by locationfound below
const clickMarkerIcon = L.divIcon({
    className: "",
    html: `<div style="
        background: red;
        width: 20px;
        height: 20px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid white;
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 20]
});


// --- Helper to build a label with a color swatch ---
function swatchLabel(color, text) {
    return `<span style="
        display:inline-block;
        width:12px;
        height:12px;
        background:${color};
        border-radius:3px;
        margin-right:6px;
        vertical-align:middle;
    "></span>${text}`;
}

function toggleDisclaimer() {
    document.getElementById("disclaimer-box").classList.toggle("visible");
}


// =====================================================
// Data layers (WMU, Crown Land, Parks, First Nations, Metis)
// =====================================================

Promise.all([
    fetch("data/WMU.geojson").then(res => res.json()),
    fetch("data/Green Area.geojson").then(res => res.json()),
    fetch("data/Protected Area Designations.geojson").then(res => res.json()),
    fetch("data/First Nations Reserve.geojson").then(res => res.json()),
    fetch("data/Metis Settlement.geojson").then(res => res.json()),
    fetch("data/WildlifeCorridor.geojson").then(res => res.json())
])
    .then(([wmuData, crownData, parkData, firstNationsData, metisData, wildlifeCorridorData]) => {

        // --- WMU Boundaries ---
        const wmuLayer = L.geoJSON(wmuData, {
            style: { color: "#d89e22 ", weight: 1, fill: false, opacity: 1 },
            onEachFeature: (feature, layer) => {
                layer.bindPopup(`
                    <h3>Wildlife Management Unit</h3>
                    <p>WMU: ${feature.properties.WMUNIT_NAME || "Unknown"}</p>
                `);

                const code = feature.properties.WMUNIT_CODE;
                if (code && code.trim() !== "") {
                    layer.bindTooltip(code.replace(/^0+/, "") || feature.properties.WMUNIT_NAME, {
                        permanent: true,
                        direction: "center",
                        className: "wmu-label"
                    });
                }
            }
        });

        // --- Crown Land (Green Area only) ---
        const crownLayer = L.geoJSON(crownData, {
            filter: feature => feature.properties.t18834Name === "Green Area",
            style: { color: "#21c153", weight: 2 , fillOpacity: 0.1 }
        });

        // --- Provincial/National Parks ---
        const parkLayer = L.geoJSON(parkData, {
            filter: feature => feature.properties.TYPE === "PP" || feature.properties.TYPE === "NP",
            style: { color: "black", weight: 1, fillOpacity: 0.5 }
        });

        // --- First Nations Reserves ---
        const firstNationsLayer = L.geoJSON(firstNationsData, {
            style: { color: "#ae2e1d", weight: 1, fillOpacity: 0.3 },
            onEachFeature: (feature, layer) => {
                layer.bindPopup(`<h3>First Nations Reserve</h3><p>${feature.properties.IRES_NAME || "Unknown"}</p>`);
            }
        });

        // --- Metis Settlements ---
        const metisLayer = L.geoJSON(metisData, {
            style: { color: "#004773", weight: 1, fillOpacity: 0.3 },
            onEachFeature: (feature, layer) => {
                layer.bindPopup(`<h3>Metis Settlement</h3><p>${feature.properties.METIS_NAME || "Unknown"}</p>`);
            }
        });

        /// --- Wild life corridors --- 
        const wildlifeCorridorLayer = L.geoJSON(wildlifeCorridorData, {
            style: { color: "black", weight: 1, fillOpacity: 0.3 },
            onEachFeature: (feature, layer) => {
                layer.bindPopup(`<h3>Wildlife Corridor</h3><p>${feature.properties.Corridor_Name || "Unknown"}</p>`);
            }
        });

        // --- One single overlays object for everything ---
        const overlays = {
            [swatchLabel("#d89e22", "WMU Boundaries")]: wmuLayer,
            [swatchLabel("#21c153", "Crown Land")]: crownLayer,
            [swatchLabel("black", "Provincial/National Parks")]: parkLayer,
            [swatchLabel("black", "Wildlife Corridors")]: wildlifeCorridorLayer,
            [swatchLabel("#ae2e1d", "First Nations Reserves")]: firstNationsLayer,
            [swatchLabel("#004773", "Metis Settlements")]: metisLayer,
     
        };

        // --- Restore saved layer visibility from localStorage ---
        const savedLayerState = JSON.parse(localStorage.getItem("layerState") || "{}");

        Object.entries(overlays).forEach(([name, layer]) => {
            const isOn = savedLayerState[name] !== undefined ? savedLayerState[name] : true;
            if (isOn) layer.addTo(map);
        });

        map.fitBounds(wmuLayer.getBounds());

        // --- Base layers ---
        const baseLayers = {
            "OpenStreetMap": osm,
            "ESRI Satellite": satellite
        };

        // --- Restore saved base layer choice ---
        const savedBase = localStorage.getItem("baseLayer");

        if (savedBase === "ESRI Satellite") {
            map.removeLayer(osm);
            satellite.addTo(map);
        }

        // --- One single layer control ---
        L.control.layers(baseLayers, overlays).addTo(map);

        // --- Save base layer choice whenever switched ---
        map.on("baselayerchange", e => {
            localStorage.setItem("baseLayer", e.name);
        });

        // --- Save layer visibility whenever toggled ---
        map.on("overlayadd", e => {
            savedLayerState[e.name] = true;
            localStorage.setItem("layerState", JSON.stringify(savedLayerState));
        });

        map.on("overlayremove", e => {
            savedLayerState[e.name] = false;
            localStorage.setItem("layerState", JSON.stringify(savedLayerState));
        });

        // --- WMU label sizing on zoom ---
        function updateLabelSize() {
            const zoom = map.getZoom();
            const fontSize = Math.max(8, zoom * 1.2);
            document.querySelectorAll(".wmu-label").forEach(label => {
                label.style.fontSize = `${fontSize}px`;
            });
        }
        map.on("zoomend", updateLabelSize);
        updateLabelSize();
    })
    .catch(err => console.error("Failed to load one or more layers:", err));


// =====================================================
// User location
// =====================================================

map.locate({ setView: false, maxZoom: 12 });

map.on("locationfound", e => {
    L.marker(e.latlng).addTo(map);
    L.circle(e.latlng, { radius: e.accuracy / 2 }).addTo(map);
});

map.on("locationerror", e => {
    console.error("Location access denied or unavailable:", e.message);
});


// =====================================================
// User-added markers (click to place, with description, deletable, persisted)
// =====================================================

const userMarkers = [];
let pendingCoords = null; // temporarily holds the click location while the user types

// --- Load saved markers from localStorage ---
function loadSavedMarkers() {
    const saved = JSON.parse(localStorage.getItem("userMarkers") || "[]");

    saved.forEach(data => {
        const marker = L.marker([data.lat, data.lng], { icon: clickMarkerIcon }).addTo(map);

        marker.bindPopup(`
            ${data.description}<br>
            <button onclick="deleteMarker(${userMarkers.length})">Delete</button>
        `);

        userMarkers.push(marker);
    });
}

// --- Save current markers to localStorage ---
function saveMarkers() {
    const data = userMarkers
        .filter(m => m !== null) // skip deleted slots
        .map(m => ({
            lat: m.getLatLng().lat,
            lng: m.getLatLng().lng,
            description: m.getPopup().getContent().split("<br>")[0] // grab just the description text
        }));

    localStorage.setItem("userMarkers", JSON.stringify(data));
}

loadSavedMarkers();

// --- Click the map to start placing a marker ---
map.on("click", e => {
    if (measuring) {
        handleMeasureClick(e);
        return; // don't place a marker if in measuring mode
    }

    pendingCoords = e.latlng;

    // Open a temporary popup asking for a description
    L.popup()
        .setLatLng(pendingCoords)
        .setContent(`
            <div>
                <input id="markerDescInput" type="text" placeholder="Enter description" />
                <button onclick="confirmMarker()">Add marker</button>
            </div>
        `)
        .openOn(map);
});

// --- Called when the "Add marker" button is clicked ---
function confirmMarker() {
    const description = document.getElementById("markerDescInput").value || "No description";

    map.closePopup(); // close the "enter description" popup first

    const marker = L.marker(pendingCoords, { icon: clickMarkerIcon }).addTo(map);

    marker.bindPopup(`
        ${description}<br>
        <button onclick="deleteMarker(${userMarkers.length})">Delete</button>
    `).openPopup(); // show the new popup right away

    userMarkers.push(marker);
    saveMarkers();
}

// --- Called when a marker's own delete button is clicked ---
function deleteMarker(index) {
    map.removeLayer(userMarkers[index]);
    userMarkers[index] = null;
    saveMarkers();
}

// =====================================================
// Distance measurement tool
// =====================================================

let measuring = false;
let measurePoints = [];
let measureMarkers = [];
let measureLine = null;

function toggleMeasureTool() {
    measuring = !measuring;
    const btn = document.getElementById("distance-tool");

    if (measuring) {
        clearMeasurement(); // reset any previous measurement first
        btn.classList.add("active");
        map.getContainer().style.cursor = "crosshair";
    } else {
        btn.classList.remove("active");
        map.getContainer().style.cursor = "";
    }
}

function handleMeasureClick(e) {
    measurePoints.push(e.latlng);

    const marker = L.circleMarker(e.latlng, {
        radius: 3,
        color: "red",
        fillColor: "red",
        fillOpacity: 1
    }).addTo(map);
    measureMarkers.push(marker);

    if (measurePoints.length === 2) {
        measureLine = L.polyline(measurePoints, { color: "red", weight: 2, dashArray: "6 6" }).addTo(map);

        const distanceKm = measurePoints[0].distanceTo(measurePoints[1]) / 1000;

        const resultBox = document.getElementById("distance-result");
        resultBox.textContent = `Distance: ${distanceKm.toFixed(2)} km`;
        resultBox.style.display = "block";

        // measuring mode auto-turns off after the second point
        measuring = false;
        document.getElementById("distance-tool").classList.remove("active");
        map.getContainer().style.cursor = "";
    }
}

function clearMeasurement() {
    measurePoints = [];
    measureMarkers.forEach(m => map.removeLayer(m));
    measureMarkers = [];
    if (measureLine) {
        map.removeLayer(measureLine);
        measureLine = null;
    }
    document.getElementById("distance-result").style.display = "none";
}

document.getElementById("distance-tool").addEventListener("click", toggleMeasureTool);