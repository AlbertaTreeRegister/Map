const mobile = window.matchMedia("(max-width: 767px)").matches;
let map = '';
let treeLayer = '';
let treeRecords = [];
let nominating = false;
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

//setup loading screen
document.addEventListener("DOMContentLoaded", function() {
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

function addTreeMarkers() {
  let treeFeatures = [];

  // Add markers to the map
  treeRecords.forEach(function(record) {
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
  });

  let iconStyles = {
    'Individual Tree': new ol.style.Style({
      image: new ol.style.Icon({
        src: 'img/tree.png',
        anchor: [0.5, 1]
      }),
      text: new ol.style.Text({
        font: '14px Calibri,sans-serif',
        fill: new ol.style.Fill({ color: '#000' }),
        stroke: new ol.style.Stroke({
          color: '#fff', width: 3
        }),
        offsetY: 18,
      })
    }),
    'Grove of Trees': new ol.style.Style({
      image: new ol.style.Icon({
        src: 'img/forest.png',
        anchor: [0.5, 1],
      }),
      text: new ol.style.Text({
        font: '14px Calibri,sans-serif',
        fill: new ol.style.Fill({ color: '#000' }),
        stroke: new ol.style.Stroke({
          color: '#fff', width: 3
        }),
        offsetY: 18,
      })
    })
  };

  let baseTileLayer = new ol.layer.Tile({
    source: new ol.source.OSM({
      attributions: []
    })
  });

  treeLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
      features: treeFeatures
    }),
    style: function (feature) {
      let iconStyle = iconStyles[feature.get('Category')];
      let style = iconStyle ? iconStyle : iconStyles["Individual Tree"];
      if(map.getView().getZoom() > 14) {
        style.getText().setText(feature.get('Tree Name'));
      }
      else {
        style.getText().setText('');
      }
      return style;
    }
  });

  // Set up the map
  map = new ol.Map({
    target: 'map',
    layers: [baseTileLayer, treeLayer],
    view: new ol.View({
      //center: ol.proj.fromLonLat([-114.337082, 54.678073]),
      zoom: 6, // Set an appropriate zoom level for your data
      enableRotation: false,
      maxZoom: 19,
      minZoom: 5
    }),
    controls: []
  });

  // Add an event listener for window resize events
  window.addEventListener('resize', function() {
    // Update the size of the map
    map.updateSize();
  });

  if(!mobile) {
    map.getView().fit([-14590808.089638153,
      6089851.591243762,
      -9581431.003940841,
      8560296.345420659]);
  }
  else {
    map.getView().fit([-13446710.605935464,
      6181500.185909358,
      -12105847.751029612,
      9083264.928320995]);
  }

  setupMapFunctions();

  //map.addLayer(markerLayer);
  document.getElementById("loading-screen").style.display = "none";

  map.once('postrender', function(event) {
    // Get the size of the map container element
    const container = document.getElementById('map');
    const containerSize = [container.clientWidth, container.clientHeight];

    // Set the size of the map canvas to match the size of the container element
    map.setSize(containerSize);
  });
}

function setupMapFunctions() {
  map.on('click', function(event) {
    if(nominating) {
      const coordinate = event.coordinate;
      const latitude = ol.proj.toLonLat(coordinate)[1];
      const longitude = ol.proj.toLonLat(coordinate)[0];
      const airtableFormUrl = `https://airtable.com/shrT9KRuUUqyMQJ89?prefill_Latitude=${latitude}&prefill_Longitude=${longitude}`;
      window.open(airtableFormUrl, '_blank');
      disableNominating();
    }
    else {
      let feature = map.forEachFeatureAtPixel(event.pixel, function (feature) {
        return feature;
      });
      showTreeInfo(feature);
    }
  });

  if (!mobile) {
    // setup mouseover tooltip
    let tooltipOverlay = new ol.Overlay({
      element: document.getElementById('tooltip'),
      positioning: 'bottom-center',
      offset: [0, -20]
    });

    map.addOverlay(tooltipOverlay);

    map.on('pointermove', function (evt) {
      let feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
        return feature;
      });

      if (feature) {
        let coordinate = evt.coordinate;
        tooltipOverlay.setPosition(coordinate);
        tooltipOverlay.getElement().innerHTML = feature.get('Tree Name');
        tooltipOverlay.getElement().style.display = 'block';
      } else {
        tooltipOverlay.getElement().style.display = 'none';
      }
    });
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

    displayFields.forEach(function(field){
      let fieldValue = feature.get(field);
      if(fieldValue) {
        html += `<p><strong>${field}:</strong> ${fieldValue}</p>`;
      }
    });

    // Update Info Panel with Tree Information
    const infoPanel = document.getElementById('infoPanel-content');
    infoPanel.innerHTML = html;

    // Add Google Maps button to bottom of Tree Info
    let googleMapsButton = document.createElement('button');
    googleMapsButton.style.border = "none";
    googleMapsButton.style.background = "none";
    googleMapsButton.title = "Open in Google Maps";
    let googleMapsIcon = '<img id="googleMapsIcon" src="img/google-maps-old.svg" style="width: 48px; height: 48px">';
    googleMapsButton.innerHTML = googleMapsIcon;
    //googleMapsButton.appendChild(googleMapsIcon);
    //googleMapsButton.innerHTML = 'Open in Google Maps';
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
          img.addEventListener('load', function() {
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
          //image.style.maxHeight = '600px';
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

          document.addEventListener('fullscreenchange', function () {
            if (document.fullscreenElement) {
              image.style.width = '100%';
              image.style.height = '100%';
              image.style.position = 'fixed';
              image.style.top = '0';
              image.style.left = '0';
              image.style.zIndex = '9999';
            } else {
              image.style.width = '';
              image.style.height = '';
              image.style.position = '';
              image.style.top = '';
              image.style.left = '';
              image.style.zIndex = '';
            }
          });
        });
      }
      const carousel = new bootstrap.Carousel('#treeCarousel');
    }
    else {
      scrollInfoPanelUp();
    }
  }
}

function scrollInfoPanelUp() {
  if (window.matchMedia("(max-width: 767px)").matches) {
    // On mobile devices
    const myDiv = document.getElementById('infoPanel');
    const rect = myDiv.getBoundingClientRect();
    const offset = window.pageYOffset;
    const top = rect.top + offset;

    window.scrollTo({
      top: top,
      behavior: 'smooth'
    });
  }
}

function activateNominating()
{
  if(nominating) {
    disableNominating();
  }
  else {
    nominating = true;
    const mapElement = document.getElementById('map');
    mapElement.style.cursor = 'crosshair';
    document.getElementById('nominateBtn').textContent = 'Cancel Nominating';
  }
}

function disableNominating()
{
  nominating = false;
  const mapElement = document.getElementById('map');
  mapElement.style.cursor = 'auto';
  document.getElementById('nominateBtn').textContent = 'Nominate a Tree';
}

function buildLeaderboard() {
  resetCarousel();
  // Create the table element and add it to the container
  let tableElement = document.createElement('table');
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

  if(topTrees.length !== 20) {
    treeRecords.sort(function (a, b) {
      return b.fields["Species Score"] - a.fields["Species Score"];
    });

    topTrees = treeRecords.slice(0, 20);
  }

  topTrees.forEach(function(tree) {
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
    rowElement.addEventListener('click', function(event) {
      // Zoom the map to the corresponding feature
      let feature = treeLayer.getSource().getFeatureById(tree.id);
      let extent = feature.getGeometry().getExtent();
      //
      map.getView().fit(extent, { duration: 1000, minResolution: map.getView().getResolutionForZoom(16) });

      // Simulate a click event on the feature
      showTreeInfo(feature);
    });
  });
  // Update Info Panel with Tree Information
  const infoPanel = document.getElementById('infoPanel-content');
  infoPanel.innerHTML = `<p class="treeName"><strong>Top 20 Trees</strong></p>`;
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

// hide carousel controls by default
const carouselNextBtn = document.querySelector(".carousel-control-next");
const carouselPrevBtn = document.querySelector(".carousel-control-prev");
carouselNextBtn.style.display = "none";
carouselPrevBtn.style.display = "none";

fetchTreeRecords();
