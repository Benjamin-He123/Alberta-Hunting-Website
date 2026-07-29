// Create map
const map = L.map("map").setView([54.5, -115.0], 6);

const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
        maxZoom: 19
    }
);

Promise.all([
    fetch("data/WMU.geojson").then(res => res.json()),
    fetch("data/Green Area.geojson").then(res => res.json()),
    fetch("data/Protected Area Designations.geojson").then(res => res.json()),
    fetch("data/First Nations Reserve.geojson").then(res => res.json()),
    fetch("data/Metis Settlement.geojson").then(res => res.json())
])
.then(([wmuData, crownData, parkData, firstNationsData, metisData]) => {

    // --- WMU Boundaries ---
    const wmuLayer = L.geoJSON(wmuData, {
        style: { color: "#ae2e1d", weight: 1, fill: false, opacity: 1 },
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
        filter: (feature) => feature.properties.t18834Name === "Green Area",
        style: { color: "#21c153", weight: 1, fillOpacity: 0.1 },
    });

    // --- Provincial/National Parks ---
    const parkLayer = L.geoJSON(parkData, {
        filter: (feature) => feature.properties.TYPE === "PP" || feature.properties.TYPE === "NP",
        style: { color: "black", weight: 1, fillOpacity: 0.5 },
    });

    // --- First Nations Reserves ---
    const firstNationsLayer = L.geoJSON(firstNationsData, {
        style: { color: "#d89e22", weight: 1, fillOpacity: 0.3 },
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

    // --- One single overlays object for everything ---
    const overlays = {
        "WMU Boundaries": wmuLayer,
        "Crown Land": crownLayer,
        "Provincial/National Parks": parkLayer,
        "First Nations Reserves": firstNationsLayer,
        "Metis Settlements": metisLayer
    };

    // --- Restore saved layer visibility from localStorage ---
    const saved = JSON.parse(localStorage.getItem("layerState") || "{}");

    Object.entries(overlays).forEach(([name, layer]) => {
        const isOn = saved[name] !== undefined ? saved[name] : true;
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
    map.on("baselayerchange", (e) => {
        localStorage.setItem("baseLayer", e.name);
    });

    // --- Save layer visibility whenever toggled ---
    map.on("overlayadd", (e) => {
        saved[e.name] = true;
        localStorage.setItem("layerState", JSON.stringify(saved));
    });

    map.on("overlayremove", (e) => {
        saved[e.name] = false;
        localStorage.setItem("layerState", JSON.stringify(saved));
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

// --- Attempt to locate user ---
map.locate({ setView: true, maxZoom: 12 });

map.on("locationfound", (e) => {
    L.marker(e.latlng).addTo(map);
    L.circle(e.latlng, { radius: e.accuracy / 2 }).addTo(map);
});

map.on("locationerror", (e) => {
    console.error("Location access denied or unavailable:", e.message);
});