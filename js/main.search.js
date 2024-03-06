let municipalities = [];
let neighbourhoods = [];

// search through municipalities, neighbourhoods, and trees and return the results
function searchAll(query) {
  query = query.toLowerCase();
  const municipalityResults = searchMunicipalities(query);
  const neighbourhoodResults = searchNeighbourhoods(query);
  const treeResults = searchTrees(query);
  return {
    municipalities: municipalityResults,
    neighbourhoods: neighbourhoodResults,
    trees: treeResults,
  };
}

// search through neighbourhoods and return the results
function searchNeighbourhoods(query) {
  return neighbourhoods.filter((neighbourhood) => {
    return neighbourhood.fields["Community"].toLowerCase().includes(query);
  });
}

// search through municipalities and return the results
function searchMunicipalities(query) {
  return municipalities.filter((municipality) => {
    return municipality.fields["Municipality"].toLowerCase().includes(query);
  });
}

function searchTrees(query) {
  query = query.toLowerCase();
  return Trees.records.filter((tree) => {
    const name = tree.fields["Tree Name"]
      ? tree.fields["Tree Name"].toLowerCase()
      : "";
    const address = tree.fields.Address
      ? tree.fields.Address.toLowerCase()
      : "";
    const neighbourhood =
      tree.fields["Neighbourhood Text"] && tree.fields["Neighbourhood Text"][0]
        ? tree.fields["Neighbourhood Text"][0].toLowerCase()
        : "";
    const species =
      tree.fields["Genus species Text"] && tree.fields["Genus species Text"][0]
        ? tree.fields["Genus species Text"][0].toLowerCase()
        : "";

    return (
      (name && name.includes(query)) ||
      (address && address.includes(query)) ||
      (neighbourhood && neighbourhood.includes(query)) ||
      (species && species.includes(query))
    );
  });
}

function showSearch() {
  if (neighbourhoods.length === 0) {
    fetchNeighbourhoods();
  }
  if (municipalities.length === 0) {
    fetchMunicipalities();
  }

  resetCarousel();
  clearSelectedLocation();
  const infoPanel = document.getElementById("infoPanel-content");
  infoPanel.innerHTML = `<p class="treeName"><strong>Search</strong></p>`;
  infoPanel.style.padding = "20px";

  const searchContainer = document.createElement("div");
  searchContainer.classList.add("search-container");

  // Create the input field
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.id = "searchInput";

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

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const query = searchInput.value;
      const results = searchAll(query);

      // Handle the search results (e.g., display them on the page)
      displaySearchResults(results);
    }
  });

  searchButton.addEventListener("click", () => {
    const searchInput = document.getElementById("searchInput");
    const query = searchInput.value;
    const results = searchAll(query);

    // Handle the search results (e.g., display them on the page)
    displaySearchResults(results);
  });

  const searchResultsContainer = document.createElement("div");
  searchResultsContainer.classList.add("search-results-container");
  infoPanel.appendChild(searchResultsContainer);

  searchInput.focus();

  function displaySearchResults(results) {
    searchResultsContainer.innerHTML = "";
    // Create the table element and add it to the container
    const tableElement = document.createElement("table");
    tableElement.id = "searchResultsTable";
    tableElement.classList.add("table");

    // Create the table header element and add it to the table
    const tableHeaderElement = document.createElement("thead");
    const tableHeaderRowElement = document.createElement("tr");
    tableHeaderRowElement.style.cursor = "auto";
    const nameHeaderElement = document.createElement("th");
    nameHeaderElement.innerText = "Name";
    const typeHeaderElement = document.createElement("th");
    typeHeaderElement.innerText = "Type";
    tableHeaderRowElement.appendChild(nameHeaderElement);
    tableHeaderRowElement.appendChild(typeHeaderElement);
    tableHeaderElement.appendChild(tableHeaderRowElement);
    tableElement.appendChild(tableHeaderElement);

    // Create the table body element and add it to the table
    const tableBodyElement = document.createElement("tbody");
    tableElement.appendChild(tableBodyElement);

    // if no results are found, display a message
    if (results.municipalities.length === 0 && results.neighbourhoods.length === 0 && results.trees.length === 0) {
      searchResultsContainer.innerHTML = `<p style="margin: revert;">No Results Found.</p>`;
      scrollInfoPanelUp();
      return;
    }

    // add municipalities to the search results table
    results.municipalities.forEach((municipality) => {
      // Create a new row element
      const rowElement = document.createElement("tr");
      rowElement.setAttribute("data-feature-id", municipality.id);

      // Create new cell elements for each field and add them to the row
      const nameCell = document.createElement("td");
      nameCell.innerText = municipality.fields["Municipality"];
      rowElement.appendChild(nameCell);

      const typeCell = document.createElement("td");
      typeCell.innerText = "Municipality";
      rowElement.appendChild(typeCell);

      // Add the row to the table body
      tableBodyElement.appendChild(rowElement);

      // Add a click event listener to each table row
      rowElement.addEventListener("click", function (event) {
        // zoom to coordinates of municipality
        zoomToMunicipality(municipality);
      });
    });

    // add neighbourhoods to the search results table
    results.neighbourhoods.forEach((neighbourhood) => {
      // Create a new row element
      const rowElement = document.createElement("tr");
      rowElement.setAttribute("data-feature-id", neighbourhood.id);

      // Create new cell elements for each field and add them to the row
      const nameCell = document.createElement("td");
      nameCell.innerText = neighbourhood.fields["Community"];
      rowElement.appendChild(nameCell);

      const typeCell = document.createElement("td");
      typeCell.innerText = "Neighbourhood";
      rowElement.appendChild(typeCell);

      // Add the row to the table body
      tableBodyElement.appendChild(rowElement);

      // Add a click event listener to each table row
      rowElement.addEventListener("click", function (event) {
        // zoom to coordinates of neighbourhood
        zoomToNeighbourhood(neighbourhood);
      });
    });

    // add trees to the search results table
    results.trees.forEach((tree) => {
      // Create a new row element
      const rowElement = document.createElement("tr");
      rowElement.setAttribute("data-feature-id", tree.id);

      // Create new cell elements for each field and add them to the row
      const nameCell = document.createElement("td");
      nameCell.innerText = tree.fields["Tree Name"];
      rowElement.appendChild(nameCell);

      const typeCell = document.createElement("td");
      typeCell.innerText = "Plant";
      rowElement.appendChild(typeCell);

      // Add the row to the table body
      tableBodyElement.appendChild(rowElement);

      // Add a click event listener to each table row
      rowElement.addEventListener("click", function (event) {
        selectTree(tree.id);
      });
    });

    searchResultsContainer.appendChild(tableElement);
    scrollInfoPanelUp();
  }

  scrollInfoPanelUp();
}

// fetches neighbourhoods and their coordinates from airtable
async function fetchNeighbourhoods() {
  const baseId = "appQryFCb5Fi3nZ4c";
  const tableName = "tblINLME55PDTlLoM";
  const mapViewId = "viwpByxZWJh6W7IqV";
  const airtableUrl = `https://api.airtable.com/v0/${baseId}/${tableName}?view=${mapViewId}&fields[]=Community&fields[]=Latitude&fields[]=Longitude`;
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
  neighbourhoods = data.records;
  offset = data.offset;

  while (offset) {
    const url = airtableUrl + `&offset=${offset}`;
    let response = await fetch(url, {
      headers,
    });
    let data = await response.json();
    neighbourhoods = [...neighbourhoods, ...data.records];
    offset = data.offset;
  }
}

// fetches municipalities and their coordinates from AirTable
async function fetchMunicipalities() {
  const baseId = "appQryFCb5Fi3nZ4c";
  const tableName = "tbl4VepS6mAXOPPej";
  const mapViewId = "viwQ0CNwn2oCkEdWx";
  const airtableUrl = `https://api.airtable.com/v0/${baseId}/${tableName}?view=${mapViewId}&fields[]=Municipality&fields[]=Latitude&fields[]=Longitude`;
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
  municipalities = data.records;
  offset = data.offset;

  while (offset) {
    const url = airtableUrl + `&offset=${offset}`;
    let response = await fetch(url, {
      headers,
    });
    let data = await response.json();
    municipalities = [...municipalities, ...data.records];
    offset = data.offset;
  }
}
