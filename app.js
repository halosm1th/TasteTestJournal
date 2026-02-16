const STORAGE_KEY = "taste-test-journal.v1";

const form = document.getElementById("strainForm");
const listEl = document.getElementById("strainList");
const entryCountEl = document.getElementById("entryCount");
const template = document.getElementById("strainCardTemplate");

const searchTextEl = document.getElementById("searchText");
const minRatingEl = document.getElementById("minRating");
const minThcEl = document.getElementById("minThc");
const maxThcEl = document.getElementById("maxThc");
const minCbdEl = document.getElementById("minCbd");
const sortByEl = document.getElementById("sortBy");

const customMetricsEl = document.getElementById("customMetrics");
const newMetricNameEl = document.getElementById("newMetricName");
const addMetricBtn = document.getElementById("addMetricBtn");
const resetBtn = document.getElementById("resetBtn");

let entries = loadEntries();
let customMetricNames = collectCustomMetricNames(entries);

init();

function init() {
  renderCustomMetricInputs();
  render();

  form.addEventListener("submit", handleSave);
  addMetricBtn.addEventListener("click", addMetricField);
  resetBtn.addEventListener("click", resetForm);

  [searchTextEl, minRatingEl, minThcEl, maxThcEl, minCbdEl, sortByEl].forEach((el) => {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function collectCustomMetricNames(list) {
  const names = new Set();
  list.forEach((entry) => {
    Object.keys(entry.customPercentages ?? {}).forEach((name) => names.add(name));
  });
  return [...names].sort((a, b) => a.localeCompare(b));
}

function addMetricField() {
  const name = newMetricNameEl.value.trim();
  if (!name || customMetricNames.includes(name)) {
    return;
  }

  customMetricNames.push(name);
  customMetricNames.sort((a, b) => a.localeCompare(b));
  newMetricNameEl.value = "";
  renderCustomMetricInputs();
}

function renderCustomMetricInputs(values = {}) {
  customMetricsEl.innerHTML = "";

  customMetricNames.forEach((metricName) => {
    const row = document.createElement("div");
    row.className = "custom-metric-row";

    const label = document.createElement("label");
    label.textContent = `${metricName} %`;

    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.01";
    input.min = "0";
    input.max = "100";
    input.dataset.metricName = metricName;
    input.value = values[metricName] ?? "";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ghost";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      customMetricNames = customMetricNames.filter((name) => name !== metricName);
      entries = entries.map((entry) => {
        if (!entry.customPercentages) {
          return entry;
        }
        delete entry.customPercentages[metricName];
        return entry;
      });
      saveEntries();
      renderCustomMetricInputs(values);
      render();
    });

    label.appendChild(input);
    row.append(label, remove);
    customMetricsEl.appendChild(row);
  });
}

function handleSave(event) {
  event.preventDefault();

  const id = document.getElementById("entryId").value || crypto.randomUUID();
  const customPercentages = {};

  customMetricsEl.querySelectorAll("input").forEach((input) => {
    const value = toNumberOrNull(input.value);
    if (value !== null) {
      customPercentages[input.dataset.metricName] = value;
    }
  });

  const entry = {
    id,
    name: document.getElementById("name").value.trim(),
    dateBought: document.getElementById("dateBought").value || null,
    datePackaged: document.getElementById("datePackaged").value || null,
    rating: toNumberOrNull(document.getElementById("rating").value),
    thc: toNumberOrNull(document.getElementById("thc").value),
    cbd: toNumberOrNull(document.getElementById("cbd").value),
    terpenes: toNumberOrNull(document.getElementById("terpenes").value),
    notes: document.getElementById("notes").value.trim(),
    customPercentages,
    updatedAt: new Date().toISOString(),
  };

  const idx = entries.findIndex((candidate) => candidate.id === id);
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }

  customMetricNames = collectCustomMetricNames(entries);
  saveEntries();
  resetForm();
  render();
}

function resetForm() {
  form.reset();
  document.getElementById("entryId").value = "";
  renderCustomMetricInputs();
}

function render() {
  const filtered = sortEntries(filterEntries(entries));

  listEl.innerHTML = "";
  entryCountEl.textContent = `${filtered.length} strain${filtered.length === 1 ? "" : "s"} shown (${entries.length} total)`;

  if (!filtered.length) {
    listEl.innerHTML = `<p class="empty">No matching strains yet. Add one from the form.</p>`;
    return;
  }

  filtered.forEach((entry) => listEl.appendChild(buildCard(entry)));
}

function filterEntries(list) {
  const query = searchTextEl.value.trim().toLowerCase();
  const minRating = toNumberOrNull(minRatingEl.value);
  const minThc = toNumberOrNull(minThcEl.value);
  const maxThc = toNumberOrNull(maxThcEl.value);
  const minCbd = toNumberOrNull(minCbdEl.value);

  return list.filter((entry) => {
    if (query) {
      const hay = `${entry.name} ${entry.notes}`.toLowerCase();
      if (!hay.includes(query)) {
        return false;
      }
    }

    if (minRating !== null && (entry.rating ?? -Infinity) < minRating) {
      return false;
    }

    if (minThc !== null && (entry.thc ?? -Infinity) < minThc) {
      return false;
    }

    if (maxThc !== null && (entry.thc ?? Infinity) > maxThc) {
      return false;
    }

    if (minCbd !== null && (entry.cbd ?? -Infinity) < minCbd) {
      return false;
    }

    return true;
  });
}

function sortEntries(list) {
  const sortBy = sortByEl.value;
  const copy = [...list];

  copy.sort((a, b) => {
    if (sortBy === "oldest") {
      return compareDate(a.dateBought, b.dateBought);
    }
    if (sortBy === "ratingDesc") {
      return (b.rating ?? -Infinity) - (a.rating ?? -Infinity);
    }
    if (sortBy === "thcDesc") {
      return (b.thc ?? -Infinity) - (a.thc ?? -Infinity);
    }
    if (sortBy === "nameAsc") {
      return (a.name ?? "").localeCompare(b.name ?? "");
    }

    return compareDate(b.dateBought, a.dateBought);
  });

  return copy;
}

function compareDate(a, b) {
  return new Date(a || 0) - new Date(b || 0);
}

function buildCard(entry) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector("h3").textContent = entry.name;
  node.querySelector(".rating").textContent = entry.rating ? `${entry.rating}/5` : "Unrated";
  node.querySelector(".dates").textContent = formatDates(entry);
  node.querySelector(".metrics").textContent = formatMetrics(entry);
  node.querySelector(".notes").textContent = entry.notes || "No notes.";

  const links = node.querySelector(".links");
  links.append(...buildStoreLinks(entry.name));

  node.querySelector(".edit-btn").addEventListener("click", () => populateForm(entry));
  node.querySelector(".delete-btn").addEventListener("click", () => {
    entries = entries.filter((candidate) => candidate.id !== entry.id);
    saveEntries();
    render();
  });

  return node;
}

function formatDates(entry) {
  const bought = entry.dateBought ? `Bought: ${entry.dateBought}` : "Bought: —";
  const packaged = entry.datePackaged ? `Packaged: ${entry.datePackaged}` : "Packaged: —";
  return `${bought} | ${packaged}`;
}

function formatMetrics(entry) {
  const base = [
    `THC: ${entry.thc ?? "—"}%`,
    `CBD: ${entry.cbd ?? "—"}%`,
    `Terpenes: ${entry.terpenes ?? "—"}%`,
  ];

  Object.entries(entry.customPercentages ?? {}).forEach(([name, value]) => {
    base.push(`${name}: ${value}%`);
  });

  return base.join(" • ");
}

function buildStoreLinks(name) {
  const encoded = encodeURIComponent(name);
  const candidates = [
    {
      label: "Canna Cabana search",
      href: `https://cannacabana.com/search?q=${encoded}`,
    },
    {
      label: "Delta 9 search",
      href: `https://delta9.ca/search?q=${encoded}`,
    },
    {
      label: "Google fallback",
      href: `https://www.google.com/search?q=${encodeURIComponent(`${name} canna cabana delta 9`)}`,
    },
  ];

  return candidates.map(({ label, href }) => {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noreferrer noopener";
    a.textContent = label;
    return a;
  });
}

function populateForm(entry) {
  document.getElementById("entryId").value = entry.id;
  document.getElementById("name").value = entry.name;
  document.getElementById("dateBought").value = entry.dateBought ?? "";
  document.getElementById("datePackaged").value = entry.datePackaged ?? "";
  document.getElementById("rating").value = entry.rating ?? "";
  document.getElementById("thc").value = entry.thc ?? "";
  document.getElementById("cbd").value = entry.cbd ?? "";
  document.getElementById("terpenes").value = entry.terpenes ?? "";
  document.getElementById("notes").value = entry.notes ?? "";
  renderCustomMetricInputs(entry.customPercentages ?? {});
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
