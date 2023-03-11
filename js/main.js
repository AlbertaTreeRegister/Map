// Set up the map
let map = new ol.Map({
  target: 'map',
  layers: [
    new ol.layer.Tile({
      source: new ol.source.OSM()
    })
  ],
  view: new ol.View({
    center: ol.proj.fromLonLat([-114.337082, 54.678073]),
    zoom: 6
  })
});

let tooltipOverlay = new ol.Overlay({
  element: document.getElementById('tooltip'),
  positioning: 'bottom-center',
  offset: [0, -20]
});

map.addOverlay(tooltipOverlay);

// setup mouseover tooltip
map.on('pointermove', function(evt) {
  let feature = map.forEachFeatureAtPixel(evt.pixel, function(feature) {
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

let iconStyles = {
  'Individual Tree': new ol.style.Style({
    image: new ol.style.Icon({
      src: 'img/tree.png'
    })
  }),
  'Grove of Trees': new ol.style.Style({
    image: new ol.style.Icon({
      src: 'img/forest.png'
    })
  })
};

// Fetch data from Airtable
const baseId = 'appQryFCb5Fi3nZ4c';
const tableName = 'tbljBWCUMUSwrF2co';
const mapViewId = 'viw8Jbt3m4xWa1f1h';
const airtableUrl = `https://api.airtable.com/v0/${baseId}/${tableName}?view=${mapViewId}`;
const airTablePersonalAccessToken = 'patS6srnbXVthid6g.8b1b2fe74ad1685642ceadbb93e63b8223ee21d14a569f9debe2e948a563170a';
let markers = [];
let offset = '';
let allRecords = [];
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

async function fetchAllRecords() {
  const headers = {
    Authorization: `Bearer ${airTablePersonalAccessToken}`,
  };
  let response = await fetch(airtableUrl, {
    headers
  });
  let data = await response.json();
  allRecords = data.records;
  offset = data.offset;

  while (offset) {
    const url = airtableUrl + `&offset=${offset}`;
    let response = await fetch(url, {
      headers
    });
    let data = await response.json();
    allRecords = [...allRecords, ...data.records];
    offset = data.offset;
  }

  // Add markers to the map
  allRecords.forEach(function(record) {
    let marker = new ol.Feature({
      geometry: new ol.geom.Point(
        ol.proj.fromLonLat([
          record.fields.Longitude,
          record.fields.Latitude
        ])
      )
    });

    for (let propertyName in record.fields) {
      marker.set(propertyName, record.fields[propertyName]);
    }

    markers.push(marker);
  });

  let markerSource = new ol.source.Vector({
    features: markers
  });

  let markerLayer = new ol.layer.Vector({
    source: markerSource,
    style: function (feature) {
      let iconStyle = iconStyles[feature.get('Category')];
      return iconStyle ? iconStyle : iconStyles["Individual Tree"];
    }
  });

  map.addLayer(markerLayer);
}

fetchAllRecords();

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
      const carouselIndicators = document.querySelector(".carousel-indicators");
      carouselIndicators.innerHTML = "";
      const carouselInner = document.querySelector(".carousel-inner");
      carouselInner.innerHTML = "";

      let photos = feature.get('Photo');
      if (photos) {
        photos.forEach((image, index) => {
          // create carousel indicator
          const indicator = document.createElement("button");
          indicator.setAttribute("data-bs-target", "treeCarousel");
          indicator.setAttribute("data-bs-slide-to", index);
          indicator.setAttribute("aria-label", 'Slide ' + (index + 1));
          if (index === 0) indicator.classList.add("active");
          carouselIndicators.appendChild(indicator);

          // create carousel item
          const item = document.createElement("div");
          item.classList.add("carousel-item");
          if (index === 0) item.classList.add("active");

          // create image element
          const img = document.createElement("img");
          img.classList.add("d-block", "w-100");
          img.src = image.url;

          // add image to item and item to inner carousel
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
            image.addEventListener('click', function () {
              if (!document.fullscreenElement) {
                image.requestFullscreen();
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
      }
    }
  }
});

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
