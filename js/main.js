function isMobile() {
  return window.matchMedia("(max-width: 991px)").matches;
}

let map = "";
const Trees = {
  layer: "",
  records: [],
  top: [],
  withPhotos: [],
  icons: {},
};

// data and objects related to the Add a Tree functionality
const NewTree = {
  latitude: null,
  longitude: null,
  layerSource: new ol.source.Vector(),
  layer: null,
  selectingLocation: false,

  locationSelected: function () {
    return this.latitude && this.longitude;
  },
};

//setup loading screen
document.addEventListener("DOMContentLoaded", function () {
  // Show the loading screen
  document.getElementById("loading-screen").style.display = "flex";
});

async function fetchTreeRecords() {
  // Fetch data from Airtable
  const baseId = "appQryFCb5Fi3nZ4c";
  const tableName = "tbljBWCUMUSwrF2co";
  const mapViewId = "viw8Jbt3m4xWa1f1h";
  let airtableUrl = `https://api.airtable.com/v0/${baseId}/${tableName}?view=${mapViewId}`;

  // fields to include when querying Tree data from Airtable
  const queryFields = [
    "Map Icon",
    "Tree Name",
    "Description",
    "Genus species Text",
    "Species Description",
    "Tree Latitude",
    "Tree Longitude",
    "Photo",
    "Address",
    "Age",
    "Condition",
    "Height (m)",
    "Circumference (m)",
    "Canopy Spread (m)",
    "DBH (m)",
    "Species Score",
  ];

  // limit results to fields included in the queryFields array
  queryFields.forEach((field) => {
    airtableUrl += `&fields[]=${field}`;
  });

  const airTablePersonalAccessToken =
    "patS6srnbXVthid6g.8b1b2fe74ad1685642ceadbb93e63b8223ee21d14a569f9debe2e948a563170a";
  let offset = "";

  const headers = {
    Authorization: `Bearer ${airTablePersonalAccessToken}`,
  };
  let response = await fetch(airtableUrl, {
    headers,
  });
  let data = await response.json();
  Trees.records = data.records;
  offset = data.offset;

  // airtable has 100 record limit per request. offset is returned until all records are fetched
  while (offset) {
    const url = airtableUrl + `&offset=${offset}`;
    let response = await fetch(url, {
      headers,
    });
    let data = await response.json();
    Trees.records = [...Trees.records, ...data.records];
    offset = data.offset;
  }

  addTreeMarkers();
}

function getTreeStyle(feature) {
  const mapIcon = feature.get("Map Icon")
    ? feature.get("Map Icon")[0]
    : { id: "default" };

  return new ol.style.Style({
    image: new ol.style.Icon({
      img: Trees.icons[mapIcon.id],
      anchor: [0.5, 1],
      scale: 0.65,
    }),
    text: new ol.style.Text({
      font: "12px Segoe UI,sans-serif",
      fill: new ol.style.Fill({ color: "#000" }),
      stroke: new ol.style.Stroke({
        color: "#fff",
        width: 3,
      }),
      offsetY: 18,
      text: map.getView().getZoom() >= 16 ? feature.get("Tree Name") : "",
    }),
  });
}

function selectStyle(feature) {
  const mapIcon = feature.get("Map Icon")
    ? feature.get("Map Icon")[0]
    : { id: "default" };

  const selectstyle = new ol.style.Style({
    image: new ol.style.Icon({
      img: Trees.icons[mapIcon.id],
      anchor: [0.5, 1],
      scale: 0.85,
    }),
    text: new ol.style.Text({
      font: "14px Segoe UI,sans-serif",
      fill: new ol.style.Fill({ color: "#000" }),
      stroke: new ol.style.Stroke({
        color: "#add8e6",
        width: 3,
      }),
      offsetY: 18,
      text: map.getView().getZoom() >= 16 ? feature.get("Tree Name") : "",
    }),
    zIndex: 9999,
  });
  return selectstyle;
}

// select interaction - handled manually so that it plays nice with adding a tree
const selectClick = new ol.interaction.Select({
  condition: ol.events.condition.never,
  style: selectStyle,
});

async function addTreeMarkers() {
  const treeFeatures = [];

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  Trees.icons.default = await loadImage("img/tree.png");

  const imageLoadedPromises = Trees.records.map(async (record) => {
    const { fields, id } = record;
    const {
      "Tree Longitude": lon,
      "Tree Latitude": lat,
      Photo,
      "Map Icon": mapIcon,
    } = fields;

    const treeFeature = new ol.Feature({
      geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])),
    });
    treeFeature.setId(id);

    Object.entries(fields).forEach(([key, value]) => {
      treeFeature.set(key, value);
    });

    treeFeatures.push(treeFeature);

    if (Photo) {
      Trees.withPhotos.push(record);
    }

    if (mapIcon && !Trees.icons[mapIcon[0].id]) {
      Trees.icons[mapIcon[0].id] = await loadImage(mapIcon[0].url);
    }
  });

  // Wait for all images to load before initializing the map
  await Promise.all(imageLoadedPromises);

  const baseTileLayer = new ol.layer.Tile({
    source: new ol.source.OSM(),
  });

  Trees.layer = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: treeFeatures,
    }),
    style: getTreeStyle,
    // Openlayers 9.0.0 bug fix to add this class - unused otherwise
    className: "treeVectors",
  });

  NewTree.layer = new ol.layer.Vector({
    source: NewTree.layerSource,
    style: new ol.style.Style({
      fill: new ol.style.Fill({
        color: "rgba(255, 0, 0, 0.2)",
      }),
      stroke: new ol.style.Stroke({
        color: "red",
        width: 2,
      }),
    }),
    // Openlayers 9.0.0 bug fix to add this class - unused otherwise
    className: "newTreeVectors",
  });

  // Set up the map
  map = new ol.Map({
    target: "map",
    layers: [baseTileLayer, Trees.layer, NewTree.layer],
    view: new ol.View({
      zoom: 6,
      enableRotation: false,
      maxZoom: 19,
      minZoom: 5,
    }),
  });

  resetMapPosition();
  setupMapEvents();
  scrollInfoPanelUp();
  if (isMobile()) {
    document.getElementById("basicTutorial").innerHTML =
      "Scroll up to view the map. Select a tree for more information or use the menu to:";
  }

  // hide the loading screen
  document.getElementById("loading-screen").style.display = "none";
}

function resetMapPosition() {
  // default position shows all of Alberta
  if (isMobile()) {
    map
      .getView()
      .fit([
        -13588363.117644893, 6014926.988070364, -11911787.933140391,
        8916691.730482,
      ]);
  } else {
    map
      .getView()
      .fit([
        -14387713.563382847, 5974667.065817688, -10632302.157855237,
        8703494.600378199,
      ]);
  }
}

function setupMapEvents() {
  map.addInteraction(selectClick);
  map.on("click", function (event) {
    selectClick.getFeatures().clear();
    if (NewTree.selectingLocation) {
      const coordinate = event.coordinate;
      const [longitude, latitude] = ol.proj
        .toLonLat(coordinate)
        .map((coord) => coord.toFixed(5));
      NewTree.latitude = latitude;
      NewTree.longitude = longitude;
      setSelectedLocation();
      disableSelectingLocation();
    } else {
      const treeFeature = map.forEachFeatureAtPixel(
        event.pixel,
        function (feature) {
          return feature;
        }
      );
      if (treeFeature) {
        clearSelectedLocation();
        selectClick.getFeatures().push(treeFeature);
        zoomToTree(treeFeature.getId());
        scrollInfoPanelUp();
      }
    }
  });
}

function scrollInfoPanelUp() {
  const infoPanelDiv = document.getElementById("infoPanel");
  if (isMobile()) {
    // on mobile, move the div up or down so that the top edge aligns with the top edge of the screen
    const rect = infoPanelDiv.getBoundingClientRect();
    const offset = window.scrollY;
    const top = rect.top + offset;

    window.scrollTo({
      top: top,
      behavior: "smooth",
    });
  } else {
    // on desktop, scroll to the top of the info panel
    infoPanelDiv.scrollTop = 0;
  }
}

function formatMeasurementFieldValue(field, value) {
  if (field.slice(-3) === "(m)") {
    // convert meters to feet
    const measureFeet = (value * 3.28084).toFixed(2);
    return `${value.toFixed(2)}m (${measureFeet} ft)`;
  } else {
    return value;
  }
}

function createHTMLParagraph(field, value) {
  return `<p><strong>${field}:</strong> ${value}</p>`;
}

function createTreeInfoHTML(feature) {
  const html = [];
  const name = feature.get("Tree Name");
  html.push(`<p class="treeName"><strong>${name}</strong></p>`);
  const description = feature.get("Description");
  if (description) {
    html.push(`<p>${description}</p>`);
  }

  const displayFields = [
    "Address",
    "Age",
    "Condition",
    "Height (m)",
    "Circumference (m)",
    "Canopy Spread (m)",
    "DBH (m)",
  ];

  displayFields.forEach(function (field) {
    const fieldValue = feature.get(field);
    if (fieldValue) {
      const formattedValue = formatMeasurementFieldValue(field, fieldValue);
      html.push(createHTMLParagraph(field, formattedValue));
    }
  });

  const treeGenus = feature.get("Genus species Text");
  if (treeGenus) {
    html.push(createHTMLParagraph("Species", treeGenus));

    const speciesDescription = feature.get("Species Description");
    if (speciesDescription) {
      html.push(`<p>${speciesDescription}</p>`);
    }
  }
  return html.join("");
}

function createGoogleMapsButton(feature) {
  const googleMapsButton = document.createElement("button");
  googleMapsButton.style.border = "none";
  googleMapsButton.style.background = "none";
  googleMapsButton.title = "Open in Google Maps";
  const googleMapsIcon =
    '<img id="googleMapsIcon" src="img/google-maps-old.svg" style="width: 48px; height: 48px">';
  googleMapsButton.innerHTML = googleMapsIcon;
  googleMapsButton.addEventListener("click", function () {
    const latitude = feature.get("Tree Latitude");
    const longitude = feature.get("Tree Longitude");
    let url =
      "https://www.google.com/maps/search/?api=1&query=" +
      latitude +
      "%2C" +
      longitude;
    window.open(url);
  });

  return googleMapsButton;
}

function createCarouselIndicator(index) {
  const indicator = document.createElement("button");
  indicator.setAttribute("data-bs-target", "#treeCarousel");
  indicator.setAttribute("data-bs-slide-to", index);
  indicator.setAttribute("aria-label", "Slide " + (index + 1));
  if (index === 0) {
    indicator.classList.add("active");
  }
  return indicator;
}

function createCarouselItem(image, index) {
  const item = document.createElement("div");
  item.classList.add("carousel-item");
  const img = document.createElement("img");
  img.classList.add("d-block", "w-100");
  img.src = image.url;
  if (index === 0) {
    item.classList.add("active");
  }
  item.appendChild(img);
  return item;
}

function setupImageCarousel(feature) {
  // reset carousel
  resetCarousel();

  const photos = feature.get("Photo");
  if (photos) {
    const carouselIndicators = document.querySelector(".carousel-indicators");
    const carouselInner = document.querySelector(".carousel-inner");

    photos.forEach((image, index) => {
      const indicator = createCarouselIndicator(index);
      const item = createCarouselItem(image, index);

      carouselIndicators.appendChild(indicator);
      carouselInner.appendChild(item);
    });

    // show carousel controls if there are multiple images
    toggleCarouselControls(photos.length > 1);

    // Click to Fullscreen images
    if (document.fullscreenEnabled) {
      const carouselImages = document.querySelectorAll(
        "#treeCarousel .carousel-item img"
      );
      carouselImages.forEach((image) => {
        image.style.cursor = "zoom-in";
        image.addEventListener("click", function () {
          if (!document.fullscreenElement) {
            if (image.requestFullscreen) {
              image.requestFullscreen();
            } else if (image.webkitRequestFullscreen) {
              image.webkitRequestFullscreen();
            } else if (image.webkitEnterFullscreen) {
              image.webkitEnterFullscreen();
            }
            image.style.cursor = "zoom-out";
          } else {
            document.exitFullscreen();
            image.style.cursor = "zoom-in";
          }
        });
      });
    }
    const carousel = new bootstrap.Carousel("#treeCarousel");
  }
}

function showTreeInfo(feature) {
  if (feature) {
    const infoPanel = document.getElementById("infoPanel-content");
    infoPanel.style.padding = "20px";
    infoPanel.innerHTML = createTreeInfoHTML(feature);
    infoPanel.appendChild(createGoogleMapsButton(feature));
    setupImageCarousel(feature);
  }
}

function showTopTrees() {
  resetCarousel();
  clearSelectedLocation();
  // Create the table element and add it to the container
  const tableElement = document.createElement("table");
  tableElement.id = "topTreesTable";
  tableElement.classList.add("table");

  // Create the table header element and add it to the table
  const tableHeaderElement = document.createElement("thead");
  const tableHeaderRowElement = document.createElement("tr");
  tableHeaderRowElement.style.cursor = "auto";
  const nameHeaderElement = document.createElement("th");
  nameHeaderElement.innerText = "Name";
  const scoreHeaderElement = document.createElement("th");
  scoreHeaderElement.innerText = "Score";
  tableHeaderRowElement.appendChild(nameHeaderElement);
  tableHeaderRowElement.appendChild(scoreHeaderElement);
  tableHeaderElement.appendChild(tableHeaderRowElement);
  tableElement.appendChild(tableHeaderElement);

  // Create the table body element and add it to the table
  const tableBodyElement = document.createElement("tbody");
  tableElement.appendChild(tableBodyElement);

  if (Trees.top.length !== 20) {
    Trees.records.sort(function (a, b) {
      return b.fields["Species Score"] - a.fields["Species Score"];
    });

    Trees.top = Trees.records.slice(0, 20);
  }

  Trees.top.forEach(function (tree) {
    // Create a new row element
    const rowElement = document.createElement("tr");
    rowElement.setAttribute("data-feature-id", tree.id);

    // Create new cell elements for each field and add them to the row
    const nameCell = document.createElement("td");
    nameCell.innerText = tree.fields["Tree Name"];
    rowElement.appendChild(nameCell);

    const scoreCell = document.createElement("td");
    scoreCell.innerText = Number(tree.fields["Species Score"].toPrecision(4));
    rowElement.appendChild(scoreCell);

    // Add the row to the table body
    tableBodyElement.appendChild(rowElement);

    // Add a click event listener to each table row
    rowElement.addEventListener("click", function (event) {
      selectTree(tree.id);
    });
  });
  // Update Info Panel with Top Trees
  const infoPanel = document.getElementById("infoPanel-content");
  infoPanel.style.padding = "20px";
  infoPanel.innerHTML = `<p class="treeName"><strong>Top Trees</strong></p>`;
  infoPanel.appendChild(tableElement);

  scrollInfoPanelUp();
}

function resetCarousel() {
  const carouselIndicators = document.querySelector(".carousel-indicators");
  carouselIndicators.innerHTML = "";
  const carouselInner = document.querySelector(".carousel-inner");
  carouselInner.innerHTML = "";
}

function toggleCarouselControls(show) {
  const carouselIndicators = document.querySelector(".carousel-indicators");
  const carouselNextBtn = document.querySelector(".carousel-control-next");
  const carouselPrevBtn = document.querySelector(".carousel-control-prev");
  const displayStyle = show ? "" : "none";

  carouselNextBtn.style.display = displayStyle;
  carouselPrevBtn.style.display = displayStyle;
  carouselIndicators.style.display = displayStyle;
}

function selectTree(treeId) {
  // Clear the current selection
  selectClick.getFeatures().clear();
  const feature = Trees.layer.getSource().getFeatureById(treeId);
  // Add the feature to the selection
  selectClick.getFeatures().push(feature);
  zoomToTree(treeId);
  scrollInfoPanelUp();
}

function zoomToTree(treeId) {
  // Zoom the map to the corresponding feature and display its information
  const feature = Trees.layer.getSource().getFeatureById(treeId);
  const treeExtent = feature.getGeometry().getExtent();
  map.getView().fit(treeExtent, {
    duration: 500,
    minResolution:
      map.getView().getZoom() < 16
        ? map.getView().getResolutionForZoom(16)
        : map.getView().getResolution(),
  });
  showTreeInfo(feature);
}

// Zoom to the location of the neighbourhood
function zoomToNeighbourhood(neighbourhood) {
  map.getView().animate({
    center: ol.proj.fromLonLat([
      neighbourhood.fields["Longitude"],
      neighbourhood.fields["Latitude"],
    ]),
    zoom: 15,
    duration: 500,
  });
}

// zoom to the Location of the municipality
function zoomToMunicipality(municipality) {
  map.getView().animate({
    center: ol.proj.fromLonLat([
      municipality.fields["Longitude"],
      municipality.fields["Latitude"],
    ]),
    zoom: 13,
    duration: 500,
  });
}

// Pagination

const rowsPerPage = 10; // Set the number of photos per page

function createPaginationContainer() {
  const paginationContainer = document.createElement("div");
  paginationContainer.classList.add("mt-3");

  const nav = document.createElement("nav");
  const ul = document.createElement("ul");
  ul.className = "pagination justify-content-center flex-wrap";

  nav.appendChild(ul);
  paginationContainer.appendChild(nav);
  return paginationContainer;
}

function showPhotoGallery() {
  resetCarousel();
  clearSelectedLocation();
  const infoPanel = document.getElementById("infoPanel-content");
  infoPanel.innerHTML = `<p class="treeName"><strong>Photo Gallery</strong></p>`;
  infoPanel.style.padding = "20px 0 0 0";

  // Create a wrapper div for the paginated content
  const paginatedContent = document.createElement("div");
  paginatedContent.id = "paginatedContent";

  const paginationTop = createPaginationContainer();
  const paginationBottom = createPaginationContainer();
  infoPanel.appendChild(paginationTop);
  infoPanel.appendChild(paginatedContent);
  infoPanel.appendChild(paginationBottom);

  function displayPhotos(startIndex) {
    paginatedContent.innerHTML = "";
    for (
      let i = startIndex;
      i < startIndex + rowsPerPage && i < Trees.withPhotos.length;
      i++
    ) {
      const tree = Trees.withPhotos[i];
      const treePhoto = document.createElement("img");
      treePhoto.src = tree.fields["Photo"][0].url;
      treePhoto.style.width = "100%";

      // add fullscreen on click behavior to image
      if (document.fullscreenEnabled) {
        treePhoto.style.cursor = "zoom-in";
        treePhoto.addEventListener("click", function () {
          if (!document.fullscreenElement) {
            if (treePhoto.requestFullscreen) {
              treePhoto.requestFullscreen();
            } else if (treePhoto.webkitRequestFullscreen) {
              treePhoto.webkitRequestFullscreen();
            } else if (image.webkitEnterFullscreen) {
              image.webkitEnterFullscreen();
            }
            treePhoto.style.cursor = "zoom-out";
          } else {
            document.exitFullscreen();
            treePhoto.style.cursor = "zoom-in";
          }
        });
      }

      // create Tree Name paragraph element
      const treeName = document.createElement("p");
      treeName.textContent = tree.fields["Tree Name"];
      treeName.style["text-align"] = "center";
      treeName.style["font-weight"] = "bold";
      treeName.style.cursor = "pointer";

      // Zoom to tree when clicking on the Tree Name
      treeName.addEventListener("click", function (event) {
        selectTree(tree.id);
      });
      paginatedContent.appendChild(treePhoto);
      paginatedContent.appendChild(treeName);
    }
  }

  function setupPagination() {
    const ulTop = paginationTop.querySelector("ul");
    const ulBottom = paginationBottom.querySelector("ul");
    updatePagination(ulTop);
    updatePagination(ulBottom);

    function updatePagination(ul) {
      ul.innerHTML = ""; // Clear existing pagination items
      const totalPages = Math.ceil(Trees.withPhotos.length / rowsPerPage);

      for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement("li");
        li.className = "page-item";
        const a = document.createElement("a");
        a.className = "page-link";
        a.href = "#";
        a.textContent = i;

        a.addEventListener("click", (e) => {
          e.preventDefault();
          const page = parseInt(e.target.textContent);
          displayPhotos((page - 1) * rowsPerPage);
          setActivePage(page);
          scrollInfoPanelUp();
        });

        li.appendChild(a);
        ul.appendChild(li);
      }
    }
  }

  function setActivePage(page) {
    const pageItemsTop = paginationTop.querySelectorAll(".page-item");
    const pageItemsBottom = paginationBottom.querySelectorAll(".page-item");

    updateActivePage(pageItemsTop);
    updateActivePage(pageItemsBottom);

    function updateActivePage(pageItems) {
      pageItems.forEach((item, index) => {
        item.classList.toggle("active", index === page - 1);
      });
    }
  }

  displayPhotos(0);
  setupPagination();
  setActivePage(1);
  scrollInfoPanelUp();
}

function showAddATree() {
  resetCarousel();
  clearSelectedLocation();
  const infoPanel = document.getElementById("infoPanel-content");
  infoPanel.innerHTML = `<p class="treeName"><strong>Add a Tree</strong></p><p>To add a tree, first locate the tree using either your current GPS coordinates or by selecting the location of the tree on the map. Once you've located the tree, the "Add Tree" button will open a nomination form in a new window and ask you for additional information about the tree. Please be as thorough as possible to increase the chance that your submission will be verified and added to the register.</p>`;
  infoPanel.style.padding = "20px";

  // Create a new container element
  const addTreeContainer = document.createElement("div");

  // Add Bootstrap class for vertical stacking of buttons
  addTreeContainer.classList.add("d-grid", "gap-4");

  // Create the Current Location button
  const currentLocationButton = document.createElement("button");
  currentLocationButton.classList.add("btn", "btn-success");
  currentLocationButton.textContent = "Current Location";

  // Create the Select Location button
  const selectLocationButton = document.createElement("button");
  selectLocationButton.id = "selectLocationButton";
  selectLocationButton.classList.add("btn", "btn-dark");
  selectLocationButton.textContent = "Select Location";

  // Create the selected location / error message div element
  const selectedLocationMessage = document.createElement("div");
  selectedLocationMessage.id = "selectedLocation";
  selectedLocationMessage.innerHTML = "No Selected Location.";

  // Create the Add Tree button
  const addTreeButton = document.createElement("button");
  addTreeButton.id = "addTreeButton";
  addTreeButton.classList.add("btn", "btn-success");
  addTreeButton.textContent = "Add Tree";
  addTreeButton.disabled = true;

  // Append the buttons to the new div
  addTreeContainer.appendChild(currentLocationButton);
  addTreeContainer.appendChild(selectLocationButton);
  addTreeContainer.appendChild(selectedLocationMessage);
  addTreeContainer.appendChild(addTreeButton);

  // Append the new div to the container
  infoPanel.appendChild(addTreeContainer);

  // Function to get current location using Geolocation API
  function getCurrentLocation() {
    disableSelectingLocation();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        selectCurrentPosition,
        showError
      );
    } else {
      selectedLocationMessage.innerHTML =
        "Geolocation is not supported by this browser.";
    }
  }

  // Function to Select Current Position
  function selectCurrentPosition(position) {
    NewTree.latitude = position.coords.latitude.toFixed(5);
    NewTree.longitude = position.coords.longitude.toFixed(5);
    setSelectedLocation();
    scrollInfoPanelUp();
  }

  // Function to handle errors
  function showError(error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        selectedLocationMessage.innerHTML =
          "User denied the request for Geolocation.";
        break;
      case error.POSITION_UNAVAILABLE:
        selectedLocationMessage.innerHTML =
          "Location information is unavailable.";
        break;
      case error.TIMEOUT:
        selectedLocationMessage.innerHTML =
          "The request to get user location timed out.";
        break;
      case error.UNKNOWN_ERROR:
        selectedLocationMessage.innerHTML = "An unknown error occurred.";
        break;
    }
  }

  // Add event listeners for the buttons
  currentLocationButton.addEventListener("click", getCurrentLocation);
  selectLocationButton.addEventListener("click", enableSelectingLocation);
  addTreeButton.addEventListener("click", addTreeAtLocation);
  scrollInfoPanelUp();
}

function addTreeAtLocation() {
  if (NewTree.locationSelected()) {
    const airtableFormUrl = `https://airtable.com/shrT9KRuUUqyMQJ89?prefill_Tree Latitude=${encodeURIComponent(
      NewTree.latitude
    )}&prefill_Tree Longitude=${encodeURIComponent(NewTree.longitude)}`;
    // opens a new window with the airtable form for nominating a tree
    window.open(airtableFormUrl, "_blank");
  }
}

function enableSelectingLocation() {
  if (NewTree.selectingLocation) {
    disableSelectingLocation();
  } else {
    NewTree.selectingLocation = true;
    const mapElement = document.getElementById("map");
    mapElement.style.cursor = "crosshair";
    document.getElementById("selectLocationButton").textContent = "Cancel";
  }
}

function disableSelectingLocation() {
  NewTree.selectingLocation = false;
  const mapElement = document.getElementById("map");
  mapElement.style.cursor = "auto";
  document.getElementById("selectLocationButton").textContent =
    "Select Location";
}

function setSelectedLocation() {
  clearSelectedLocation();
  const selectedLocationDiv = document.getElementById("selectedLocation");
  selectedLocationDiv.innerHTML = `
    <p>Selected Location:</p>
    <p>Latitude: ${NewTree.latitude}<br>Longitude: ${NewTree.longitude}</p>`;
  const center = ol.proj.fromLonLat([NewTree.longitude, NewTree.latitude]);
  const circleGeometry = new ol.geom.Circle(center, 3);
  const circleFeature = new ol.Feature(circleGeometry);
  NewTree.layerSource.addFeature(circleFeature);
  map.getView().animate({
    center: center,
    zoom: 19,
    duration: 500,
  });
  const addTreeButton = document.getElementById("addTreeButton");
  addTreeButton.disabled = false;
}

function clearSelectedLocation() {
  NewTree.layerSource.clear();
}

// hide carousel controls by default
toggleCarouselControls(false);

fetchTreeRecords();
