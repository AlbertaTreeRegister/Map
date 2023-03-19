function isMobile() {
  return window.matchMedia("(max-width: 767px)").matches;
}

let map = '';
let treeLayer = '';
let treeRecords = [];
let selectingLocation = false;
let displayFields = [
  'Address',
  'Age',
  'Condition',
  'Height (m)',
  'Circumference (m)',
  'Canopy Spread (m)',
  'DBH (m)'
];
let topTrees = [];
let treesWithPhotos = [];
let addTreeLatitude = 0;
let addTreeLongitude = 0;
let addTreeLayer;
let addTreeSource;

//setup loading screen
document.addEventListener("DOMContentLoaded", function () {
  // Show the loading screen
  document.getElementById("loading-screen").style.display = "flex";
});

async function fetchTreeRecords() {
  // Fetch data from Airtable
  const baseId = 'appQryFCb5Fi3nZ4c';
  const tableName = 'tbljBWCUMUSwrF2co';
  const mapViewId = 'viw8Jbt3m4xWa1f1h';
  const airtableUrl = `https://api.airtable.com/v0/${baseId}/${tableName}?view=${mapViewId}`;
  const airTablePersonalAccessToken = 'patS6srnbXVthid6g.8b1b2fe74ad1685642ceadbb93e63b8223ee21d14a569f9debe2e948a563170a';
  let offset = '';

  const headers = {
    Authorization: `Bearer ${airTablePersonalAccessToken}`,
  };
  let response = await fetch(airtableUrl, {
    headers
  });
  let data = await response.json();
  treeRecords = data.records;
  offset = data.offset;

  while (offset) {
    const url = airtableUrl + `&offset=${offset}`;
    let response = await fetch(url, {
      headers
    });
    let data = await response.json();
    treeRecords = [...treeRecords, ...data.records];
    offset = data.offset;
  }

  addTreeMarkers();
}

function getTreeStyle(feature, resolution) {
  let src = 'img/';
  src += feature.get('Category') === 'Grove of Trees' ? 'forest.png' : 'tree.png';

  let style = new ol.style.Style({
    image: new ol.style.Icon({
      src: src,
      anchor: [0.5, 1]
    }),
    text: new ol.style.Text({
      font: '14px Roboto,sans-serif',
      fill: new ol.style.Fill({ color: '#000' }),
      stroke: new ol.style.Stroke({
        color: '#fff',
        width: 3,
      }),
      offsetY: 18,
      text: map.getView().getZoom() > 13.5 ? feature.get('Tree Name') : ''
    })
  });

  return style;
}

function addTreeMarkers() {
  let treeFeatures = [];

  // Add markers to the map
  treeRecords.forEach(function (record) {
    let treeFeature = new ol.Feature({
      geometry: new ol.geom.Point(
        ol.proj.fromLonLat([
          record.fields.Longitude,
          record.fields.Latitude
        ])
      )
    });
    treeFeature.setId(record.id);

    for (let propertyName in record.fields) {
      treeFeature.set(propertyName, record.fields[propertyName]);
    }

    treeFeatures.push(treeFeature);

    if ("Photo" in record.fields) {
      treesWithPhotos.push(record);
    }
  });

  let baseTileLayer = new ol.layer.Tile({
    source: new ol.source.OSM({
      attributions: []
    })
  });

  treeLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: treeFeatures
    }),
    style: getTreeStyle
  });

  addTreeSource = new ol.source.Vector();

  addTreeLayer = new ol.layer.Vector({
    source: addTreeSource,
    style: new ol.style.Style({
      fill: new ol.style.Fill({
        color: 'rgba(255, 0, 0, 0.2)', // Fill color in RGBA format
      }),
      stroke: new ol.style.Stroke({
        color: 'red', // Stroke color
        width: 2, // Stroke width
      }),
    })
  });

  // Set up the map
  map = new ol.Map({
    target: 'map',
    layers: [baseTileLayer, treeLayer, addTreeLayer],
    view: new ol.View({
      zoom: 6,
      enableRotation: false,
      maxZoom: 19,
      minZoom: 5
    }),
    controls: []
  });

  resetMapPosition();
  setupMapFunctions();
  scrollInfoPanelUp();
  if (isMobile()) {
    document.getElementById("basicTutorial").innerHTML = 'Scroll up to view the map. Select a tree for more information or use the options menu to:';
  }

  // hide the loading screen
  document.getElementById("loading-screen").style.display = "none";
}

function setupMapFunctions() {
  map.on('click', function (event) {
    if (selectingLocation) {
      const coordinate = event.coordinate;
      addTreeLatitude = ol.proj.toLonLat(coordinate)[1];
      addTreeLongitude = ol.proj.toLonLat(coordinate)[0];
      setSelectedLocation();
      disableSelectingLocation();
    } else {
      let treeFeature = map.forEachFeatureAtPixel(event.pixel, function (feature) {
        return feature;
      });
      if (treeFeature) {
        zoomToTree(treeFeature.getId());
      }
    }
  });
}

function resetMapPosition() {
  if (isMobile()) {
    map.getView().fit([-13588363.117644893,
      6014926.988070364,
    -11911787.933140391,
      8916691.730482]);
  } else {
    map.getView().fit([-14387713.563382847,
      5974667.065817688,
    -10632302.157855237,
      8703494.600378199]);
  }
}

function showTreeInfo(feature) {
  if (feature) {
    let html = '';
    let name = feature.get('Tree Name');
    html += `<p class="treeName"><strong>${name}</strong></p>`;
    let description = feature.get('Description');
    if (description) {
      html += `<p>${description}</p>`;
    }

    displayFields.forEach(function (field) {
      let fieldValue = feature.get(field);
      if (fieldValue) {
        if (field.slice(-3) === "(m)") {
          // convert meters to feet
          let measureFeet = (fieldValue * 3.28084).toFixed(2);
          html += `<p><strong>${field.slice(0, -4)}:</strong> ${fieldValue.toFixed(2)}m (${measureFeet} ft)</p>`;
        }
        else {
          html += `<p><strong>${field}:</strong> ${fieldValue}</p>`;
        }
      }
    });

    // add species info
    let treeSpecies = feature.get('Common Name');
    if (treeSpecies) {
      let treeGenus = feature.get('Genus species Text');

      html += `<p><strong>Species:</strong> ${treeSpecies} (${treeGenus})</p>`;

      let speciesDescription = feature.get('Species Description');
      if (speciesDescription) {
        html += `<p>${speciesDescription}</p>`;
      }
    }

    // Update Info Panel with Tree Information
    const infoPanel = document.getElementById('infoPanel-content');
    infoPanel.style.padding = "20px";
    infoPanel.innerHTML = html;

    // Add Google Maps button to bottom of Tree Info
    let googleMapsButton = document.createElement('button');
    googleMapsButton.style.border = "none";
    googleMapsButton.style.background = "none";
    googleMapsButton.title = "Open in Google Maps";
    let googleMapsIcon = '<img id="googleMapsIcon" src="img/google-maps-old.svg" style="width: 48px; height: 48px">';
    googleMapsButton.innerHTML = googleMapsIcon;
    googleMapsButton.addEventListener('click', function () {
      let latitude = feature.get('Latitude'); // replace with the latitude of the location
      let longitude = feature.get('Longitude'); // replace with the longitude of the location
      let url = 'https://www.google.com/maps/search/?api=1&query=' + latitude + '%2C' + longitude;
      window.open(url);
    });

    infoPanel.appendChild(googleMapsButton);

    //set up image carousel

    // reset carousel
    resetCarousel();

    let photos = feature.get('Photo');
    if (photos) {
      const carouselIndicators = document.querySelector(".carousel-indicators");
      const carouselInner = document.querySelector(".carousel-inner");

      photos.forEach((image, index) => {
        // create carousel indicator
        const indicator = document.createElement("button");
        indicator.setAttribute("data-bs-target", "#treeCarousel");
        indicator.setAttribute("data-bs-slide-to", index);
        indicator.setAttribute("aria-label", 'Slide ' + (index + 1));

        // create carousel item
        const item = document.createElement("div");
        item.classList.add("carousel-item");

        // create image element
        const img = document.createElement("img");
        img.classList.add("d-block", "w-100");
        img.src = image.url;

        if (index === 0) {
          indicator.classList.add("active");
          item.classList.add("active");
          img.addEventListener('load', function () {
            scrollInfoPanelUp();
          });
        }

        // add image to item and item to inner carousel
        carouselIndicators.appendChild(indicator);
        item.appendChild(img);
        carouselInner.appendChild(item);
      });

      const carouselNextBtn = document.querySelector(".carousel-control-next");
      const carouselPrevBtn = document.querySelector(".carousel-control-prev");
      if (photos.length === 1) {
        carouselIndicators.style.display = "none";
        carouselNextBtn.style.display = "none";
        carouselPrevBtn.style.display = "none";
      } else {
        carouselIndicators.style.display = "";
        carouselNextBtn.style.display = "";
        carouselPrevBtn.style.display = "";
      }

      // Click to Fullscreen images
      const carouselImages = document.querySelectorAll("#treeCarousel .carousel-item img");

      if (document.fullscreenEnabled) {
        carouselImages.forEach((image) => {
          image.style.cursor = 'zoom-in';
          image.addEventListener('click', function () {
            if (!document.fullscreenElement) {
              if (image.requestFullscreen) {
                image.requestFullscreen();
              } else if (image.webkitRequestFullscreen) {
                image.webkitRequestFullscreen();
              }
              image.style.cursor = 'zoom-out';
            } else {
              document.exitFullscreen();
              image.style.cursor = 'zoom-in';
            }
          });
        });
      }
      const carousel = new bootstrap.Carousel('#treeCarousel');
    } else {
      scrollInfoPanelUp();
    }
  }
}

function scrollInfoPanelUp() {
  if (isMobile()) {
    // On mobile devices
    const myDiv = document.getElementById('infoPanel');
    const rect = myDiv.getBoundingClientRect();
    const offset = window.scrollY;
    const top = rect.top + offset;

    window.scrollTo({
      top: top,
      behavior: 'smooth'
    });
  }
}

function buildTopTrees() {
  resetCarousel();
  clearSelectedLocation();
  // Create the table element and add it to the container
  let tableElement = document.createElement('table');
  tableElement.id = "topTreesTable";
  tableElement.classList.add('table');

  // Create the table header element and add it to the table
  let tableHeaderElement = document.createElement('thead');
  let tableHeaderRowElement = document.createElement('tr');
  tableHeaderRowElement.style.cursor = 'auto';
  let nameHeaderElement = document.createElement('th');
  nameHeaderElement.innerText = 'Name';
  let scoreHeaderElement = document.createElement('th');
  scoreHeaderElement.innerText = 'Score';
  tableHeaderRowElement.appendChild(nameHeaderElement);
  tableHeaderRowElement.appendChild(scoreHeaderElement);
  tableHeaderElement.appendChild(tableHeaderRowElement);
  tableElement.appendChild(tableHeaderElement);

  // Create the table body element and add it to the table
  let tableBodyElement = document.createElement('tbody');
  tableElement.appendChild(tableBodyElement);

  if (topTrees.length !== 20) {
    treeRecords.sort(function (a, b) {
      return b.fields["Species Score"] - a.fields["Species Score"];
    });

    topTrees = treeRecords.slice(0, 20);
  }

  topTrees.forEach(function (tree) {
    // Create a new row element
    let rowElement = document.createElement('tr');
    rowElement.setAttribute('data-feature-id', tree.id);

    // Create new cell elements for each field and add them to the row
    let nameCell = document.createElement('td');
    nameCell.innerText = tree.fields["Tree Name"];
    rowElement.appendChild(nameCell);

    let scoreCell = document.createElement('td');
    scoreCell.innerText = Number(tree.fields["Species Score"].toPrecision(4));
    rowElement.appendChild(scoreCell);

    // Add the row to the table body
    tableBodyElement.appendChild(rowElement);

    // Add a click event listener to each table row
    rowElement.addEventListener('click', function (event) {
      zoomToTree(tree.id);
    });
  });
  // Update Info Panel with Top Trees
  const infoPanel = document.getElementById('infoPanel-content');
  infoPanel.style.padding = "20px";
  infoPanel.innerHTML = `<p class="treeName"><strong>Top Trees</strong></p>`;
  infoPanel.appendChild(tableElement);

  scrollInfoPanelUp();
}

function resetCarousel() {
  // reset carousel
  const carouselIndicators = document.querySelector(".carousel-indicators");
  carouselIndicators.innerHTML = "";
  const carouselInner = document.querySelector(".carousel-inner");
  carouselInner.innerHTML = "";
}

function zoomToTree(treeId) {
  // Zoom the map to the corresponding feature and display its information
  let feature = treeLayer.getSource().getFeatureById(treeId);
  let treeExtent = feature.getGeometry().getExtent();
  map.getView().fit(treeExtent, {
    duration: 1000,
    minResolution: map.getView().getZoom() < 16 ? map.getView().getResolutionForZoom(16) : map.getView().getResolutionForZoom(map.getView().getZoom())
  });
  showTreeInfo(feature);
}

// hide carousel controls by default
const carouselNextBtn = document.querySelector(".carousel-control-next");
const carouselPrevBtn = document.querySelector(".carousel-control-prev");
carouselNextBtn.style.display = "none";
carouselPrevBtn.style.display = "none";

fetchTreeRecords();


// Pagination 

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

const rowsPerPage = 10; // Set the number of photos per page

function buildPhotoGallery() {
  resetCarousel();
  clearSelectedLocation();
  const infoPanel = document.getElementById('infoPanel-content');
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
    for (let i = startIndex; i < startIndex + rowsPerPage && i < treesWithPhotos.length; i++) {
      const tree = treesWithPhotos[i];
      const treePhoto = document.createElement("img");
      treePhoto.src = tree.fields["Photo"][0].url;
      treePhoto.style.width = '100%';

      // add fullscreen on click behavior to image
      if (document.fullscreenEnabled) {
        treePhoto.style.cursor = 'zoom-in';
        treePhoto.addEventListener('click', function () {
          if (!document.fullscreenElement) {
            if (treePhoto.requestFullscreen) {
              treePhoto.requestFullscreen();
            } else if (treePhoto.webkitRequestFullscreen) {
              treePhoto.webkitRequestFullscreen();
            }
            treePhoto.style.cursor = 'zoom-out';
          } else {
            document.exitFullscreen();
            treePhoto.style.cursor = 'zoom-in';
          }
        });
      }

      // create Tree Name paragraph element
      const treeName = document.createElement("p");
      treeName.textContent = tree.fields["Tree Name"];
      treeName.style["text-align"] = 'center';
      treeName.style["font-weight"] = 'bold';
      treeName.style.cursor = 'pointer';


      // Zoom to tree when clicking on the Tree Name
      treeName.addEventListener('click', function (event) {
        zoomToTree(tree.id);
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
      const totalPages = Math.ceil(treesWithPhotos.length / rowsPerPage);

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

function buildSearch() {
  resetCarousel();
  clearSelectedLocation();
  const infoPanel = document.getElementById('infoPanel-content');
  infoPanel.innerHTML = `<p class="treeName"><strong>Search</strong></p>`;
  infoPanel.style.padding = "20px";

  const searchContainer = document.createElement("div");
  searchContainer.classList.add("search-container");

  // Create the input field
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.id = "searchInput";
  searchInput.placeholder = "Search by Name or Address";

  // Create the search button
  const searchButton = document.createElement("button");
  searchButton.id = "searchButton";
  searchButton.classList.add("btn");
  searchButton.classList.add("btn-success");
  searchButton.textContent = "Search";

  // Add the input field and search button to search container
  searchContainer.appendChild(searchInput);
  searchContainer.appendChild(searchButton);
  infoPanel.appendChild(searchContainer);

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const query = searchInput.value;
      const results = searchTrees(query);

      // Handle the search results (e.g., display them on the page)
      displaySearchResults(results);
    }
  });

  searchButton.addEventListener("click", () => {
    const searchInput = document.getElementById("searchInput");
    const query = searchInput.value;
    const results = searchTrees(query);

    // Handle the search results (e.g., display them on the page)
    displaySearchResults(results);
  });

  const searchResultsContainer = document.createElement("div");
  searchResultsContainer.classList.add("search-results-container")
  infoPanel.appendChild(searchResultsContainer);

  function displaySearchResults(results) {
    searchResultsContainer.innerHTML = "";
    // Create the table element and add it to the container
    let tableElement = document.createElement('table');
    tableElement.id = "searchResultsTable";
    tableElement.classList.add('table');

    // Create the table header element and add it to the table
    let tableHeaderElement = document.createElement('thead');
    let tableHeaderRowElement = document.createElement('tr');
    tableHeaderRowElement.style.cursor = 'auto';
    let nameHeaderElement = document.createElement('th');
    nameHeaderElement.innerText = 'Name';
    let addressHeaderElement = document.createElement('th');
    addressHeaderElement.innerText = 'Address';
    tableHeaderRowElement.appendChild(nameHeaderElement);
    tableHeaderRowElement.appendChild(addressHeaderElement);
    tableHeaderElement.appendChild(tableHeaderRowElement);
    tableElement.appendChild(tableHeaderElement);

    // Create the table body element and add it to the table
    let tableBodyElement = document.createElement('tbody');
    tableElement.appendChild(tableBodyElement);

    if (results.length === 0) {
      searchResultsContainer.innerHTML = `<p style="margin: revert;">No Trees Found.</p>`;
      scrollInfoPanelUp();
      return;
    }

    results.forEach(tree => {
      // Create a new row element
      let rowElement = document.createElement('tr');
      rowElement.setAttribute('data-feature-id', tree.id);

      // Create new cell elements for each field and add them to the row
      let nameCell = document.createElement('td');
      nameCell.innerText = tree.fields["Tree Name"];
      rowElement.appendChild(nameCell);

      let addressCell = document.createElement('td');
      addressCell.innerText = tree.fields.Address;
      rowElement.appendChild(addressCell);

      // Add the row to the table body
      tableBodyElement.appendChild(rowElement);

      // Add a click event listener to each table row
      rowElement.addEventListener('click', function (event) {
        zoomToTree(tree.id);
      });
    });
    searchResultsContainer.appendChild(tableElement);
    scrollInfoPanelUp();
  }

  scrollInfoPanelUp();
}

function searchTrees(query) {
  query = query.toLowerCase();
  return treeRecords.filter(tree => {
    const name = tree.fields["Tree Name"] ? tree.fields["Tree Name"].toLowerCase() : "";
    const address = tree.fields.Address ? tree.fields.Address.toLowerCase() : "";

    return (
      (name && name.includes(query)) ||
      (address && address.includes(query))
    );
  });
}

function buildAddATree() {
  resetCarousel();
  clearSelectedLocation();
  const infoPanel = document.getElementById('infoPanel-content');
  infoPanel.innerHTML = `<p class="treeName"><strong>Add a Tree</strong></p><p>To add a tree, first locate the tree using either your current GPS coordinates or by selecting the location of the tree on the map. Once you've located the tree, the "Add" button will open a nomination form in a new window and ask you for additional information about the tree. Please be as thorough as possible to increase the chance that your submission will be verified and added to the register.</p>`;
  //infoPanel.innerHTML += ``;
  infoPanel.style.padding = "20px";

  // Create a new div element
  const addTreeContainer = document.createElement("div");

  // Add Bootstrap class for vertical stacking of buttons
  addTreeContainer.classList.add("d-grid", "gap-4");

  // Create the Current Location button
  const currentLocationButton = document.createElement("button");
  currentLocationButton.classList.add("btn", "btn-success");
  currentLocationButton.textContent = "Current Location";

  // Create the Select Location button
  const selectLocationButton = document.createElement("button");
  selectLocationButton.id = "selectLocationButton"
  selectLocationButton.classList.add("btn", "btn-dark");
  selectLocationButton.textContent = "Select Location";

  // Create the error message div element
  const selectedLocationMessage = document.createElement("div");
  selectedLocationMessage.id = 'selectedLocation';

  // Create the Confirm Location button
  const confirmLocationButton = document.createElement("button");
  confirmLocationButton.id = "confirmLocationButton"
  confirmLocationButton.classList.add("btn", "btn-success");
  confirmLocationButton.textContent = "Add";
  confirmLocationButton.disabled = true;

  // Append the buttons to the new div
  addTreeContainer.appendChild(currentLocationButton);
  addTreeContainer.appendChild(selectLocationButton);
  addTreeContainer.appendChild(selectedLocationMessage);
  addTreeContainer.appendChild(confirmLocationButton);

  // Append the new div to the container
  infoPanel.appendChild(addTreeContainer);

  // Function to get current location using Geolocation API
  function getCurrentLocation() {
    disableSelectingLocation();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(selectCurrentPosition, showError);
    } else {
      selectedLocationMessage.innerHTML = "Geolocation is not supported by this browser.";
    }
  }

  // Function to Select Current Position
  function selectCurrentPosition(position) {
    addTreeLatitude = position.coords.latitude;
    addTreeLongitude = position.coords.longitude;
    setSelectedLocation();
    scrollInfoPanelUp();
  }

  // Function to handle errors
  function showError(error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        selectedLocationMessage.innerHTML = "User denied the request for Geolocation.";
        break;
      case error.POSITION_UNAVAILABLE:
        selectedLocationMessage.innerHTML = "Location information is unavailable.";
        break;
      case error.TIMEOUT:
        selectedLocationMessage.innerHTML = "The request to get user location timed out.";
        break;
      case error.UNKNOWN_ERROR:
        selectedLocationMessage.innerHTML = "An unknown error occurred.";
        break;
    }
  }

  // Add event listeners for the buttons
  currentLocationButton.addEventListener("click", getCurrentLocation);
  selectLocationButton.addEventListener("click", enableSelectingLocation);
  confirmLocationButton.addEventListener("click", addTreeAtLocation);
  scrollInfoPanelUp();
}

function addTreeAtLocation() {
  if (addTreeLatitude !== 0 || addTreeLongitude !== 0) {
    const airtableFormUrl = `https://airtable.com/shrT9KRuUUqyMQJ89?prefill_Latitude=${addTreeLatitude}&prefill_Longitude=${addTreeLongitude}`;
    window.open(airtableFormUrl, '_blank');
  }
}

function enableSelectingLocation() {
  if (selectingLocation) {
    disableSelectingLocation();
  } else {
    selectingLocation = true;
    const mapElement = document.getElementById('map');
    mapElement.style.cursor = 'crosshair';
    document.getElementById('selectLocationButton').textContent = 'Cancel';
  }
}

function disableSelectingLocation() {
  selectingLocation = false;
  const mapElement = document.getElementById('map');
  mapElement.style.cursor = 'auto';
  document.getElementById('selectLocationButton').textContent = 'Select Location';
}

function setSelectedLocation() {
  clearSelectedLocation();
  const selectedLocation = document.getElementById("selectedLocation");
  selectedLocation.innerHTML = "<p>Selected Location:</p><p>Latitude: " + addTreeLatitude.toFixed(4) + "<br>Longitude: " + addTreeLongitude.toFixed(4) + "</p>";
  let center = ol.proj.fromLonLat([addTreeLongitude, addTreeLatitude]);
  const circleGeometry = new ol.geom.Circle(center, 3);
  const circleFeature = new ol.Feature(circleGeometry);
  addTreeSource.addFeature(circleFeature);
  map.getView().animate({
    center: center,
    zoom: 19,
    duration: 1000
  });
  const confirmLocationButton = document.getElementById("confirmLocationButton");
  confirmLocationButton.disabled = false;
}

function clearSelectedLocation() {
  addTreeSource.clear();
}