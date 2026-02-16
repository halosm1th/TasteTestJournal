const DB_VERSION = 1;

const form = document.getElementById("strainForm");
const listEl = document.getElementById("strainList");
const entryCountEl = document.getElementById("entryCount");
const template = document.getElementById("strainCardTemplate");

const searchTextEl = document.getElementById("searchText");
const minRatingEl = document.getElementById("minRating");
const minThcEl = document.getElementById("minThc");
const minCbdEl = document.getElementById("minCbd");
const sortByEl = document.getElementById("sortBy");

const customMetricsEl = document.getElementById("customMetrics");
const newMetricNameEl = document.getElementById("newMetricName");
const addMetricBtn = document.getElementById("addMetricBtn");
const resetBtn = document.getElementById("resetBtn");

const exportDbBtn = document.getElementById("exportDbBtn");
const importDbBtn = document.getElementById("importDbBtn");
const newDbBtn = document.getElementById("newDbBtn");
const importDbInput = document.getElementById("importDbInput");
const dbStatusEl = document.getElementById("dbStatus");

const ratingInput = document.getElementById("rating");
const ratingStarsEl = document.getElementById("ratingStars");

let entries = [];
let customMetricNames = [];
let dbFileName = "unsaved-db";

init();

function init() {
  renderCustomMetricInputs();
  render();
  updateDbStatus("In-memory only (import or export a file)");
  initStarRating();

  form.addEventListener("submit", handleSave);
  addMetricBtn.addEventListener("click", addMetricField);
  resetBtn.addEventListener("click", resetForm);

  exportDbBtn.addEventListener("click", exportDbFile);
  importDbBtn.addEventListener("click", () => importDbInput.click());
  importDbInput.addEventListener("change", importDbFile);
  newDbBtn.addEventListener("click", createNewDb);

  [searchTextEl, minRatingEl, minThcEl, minCbdEl, sortByEl].forEach((el) => {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });
}

function initStarRating() {
  ratingStarsEl.querySelectorAll(".star-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const value = sanitizeRating(button.dataset.value);
      ratingInput.value = value ?? "";
      syncStarRatingUI(value);
    });
  });
  syncStarRatingUI(null);
}

function syncStarRatingUI(value) {
  const safeValue = sanitizeRating(value);
  ratingStarsEl.querySelectorAll(".star-btn").forEach((button) => {
    const buttonValue = Number(button.dataset.value);
    button.classList.toggle("active", safeValue !== null && buttonValue <= safeValue);
  });
}

function updateDbStatus(message) {
  dbStatusEl.textContent = `Current DB: ${message}`;
}

function createNewDb() {
  if (!confirm("Start a new empty DB? This clears the current in-memory data.")) {
    return;
  }

  entries = [];
  customMetricNames = [];
  dbFileName = "unsaved-db";
  resetForm();
  render();
  updateDbStatus("In-memory only (new empty DB)");
}

function importDbFile(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      const parsed = JSON.parse(text);
      const normalized = normalizeImportedDb(parsed);

      entries = normalized.entries;
      customMetricNames = normalized.customMetricNames;
      dbFileName = file.name.replace(/\.json$/i, "") || "imported-db";

      resetForm();
      render();
      updateDbStatus(`${file.name} (${entries.length} strain${entries.length === 1 ? "" : "s"})`);
    } catch (error) {
      console.error(error);
      alert("That file is not a valid Taste Test Journal DB JSON file.");
    } finally {
      importDbInput.value = "";
    }
  };

  reader.readAsText(file);
}

function exportDbFile() {
  const db = buildDbPayload();
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  const safeBaseName = (dbFileName || "taste-test-journal").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const fileName = `${safeBaseName}-${stamp}.json`;

  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);

  updateDbStatus(`Exported ${fileName}`);
}

function buildDbPayload() {
  return {
    app: "taste-test-journal",
    version: DB_VERSION,
    exportedAt: new Date().toISOString(),
    customMetricNames,
    entries,
  };
}

function normalizeImportedDb(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid DB payload");
  }

  if (payload.app !== "taste-test-journal") {
    throw new Error("Not a Taste Test Journal DB file");
  }

  const importedEntries = Array.isArray(payload.entries) ? payload.entries : [];

  const safeEntries = importedEntries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: String(entry.id || crypto.randomUUID()),
      name: String(entry.name || "").trim(),
      dateBought: entry.dateBought || null,
      datePackaged: entry.datePackaged || null,
      rating: sanitizeRating(entry.rating),
      thc: sanitizePercent(entry.thc),
      cbd: sanitizePercent(entry.cbd),
      terpenes: sanitizePercent(entry.terpenes),
      notes: String(entry.notes || "").trim(),
      customPercentages: sanitizeCustomPercentages(entry.customPercentages),
      updatedAt: entry.updatedAt || new Date().toISOString(),
    }))
    .filter((entry) => entry.name);

  const metricNamesFromEntries = collectCustomMetricNames(safeEntries);
  const metricNamesFromDb = Array.isArray(payload.customMetricNames)
    ? payload.customMetricNames.map((name) => String(name).trim()).filter(Boolean)
    : [];

  return {
    entries: safeEntries,
    customMetricNames: [...new Set([...metricNamesFromDb, ...metricNamesFromEntries])].sort((a, b) =>
      a.localeCompare(b),
    ),
  };
}

function sanitizeCustomPercentages(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const result = {};
  Object.entries(value).forEach(([name, percent]) => {
    const cleanName = String(name).trim();
    const cleanPercent = sanitizePercent(percent);
    if (cleanName && cleanPercent !== null) {
      result[cleanName] = cleanPercent;
    }
  });

  return result;
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

function collectCustomMetricNames(list) {
  const names = new Set();
  list.forEach((entry) => {
    Object.keys(entry.customPercentages ?? {}).forEach((name) => names.add(name));
  });
  return [...names].sort((a, b) => a.localeCompare(b));
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
    const value = sanitizePercent(input.value);
    if (value !== null) {
      customPercentages[input.dataset.metricName] = value;
    }
  });

  const entry = {
    id,
    name: document.getElementById("name").value.trim(),
    dateBought: document.getElementById("dateBought").value || null,
    datePackaged: document.getElementById("datePackaged").value || null,
    rating: sanitizeRating(ratingInput.value),
    thc: sanitizePercent(document.getElementById("thc").value),
    cbd: sanitizePercent(document.getElementById("cbd").value),
    terpenes: sanitizePercent(document.getElementById("terpenes").value),
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
  resetForm();
  render();
}

function resetForm() {
  form.reset();
  document.getElementById("entryId").value = "";
  ratingInput.value = "";
  syncStarRatingUI(null);
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
  const minRating = sanitizeRating(minRatingEl.value);
  const minThc = sanitizePercent(minThcEl.value);
  const minCbd = sanitizePercent(minCbdEl.value);

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
  node.querySelector(".rating").textContent = entry.rating ? formatStars(entry.rating) : "Unrated";
  node.querySelector(".dates").textContent = formatDates(entry);
  node.querySelector(".metrics").textContent = formatMetrics(entry);
  node.querySelector(".notes").textContent = entry.notes || "No notes.";

  const links = node.querySelector(".links");
  links.append(...buildStoreLinks(entry.name));

  node.querySelector(".edit-btn").addEventListener("click", () => populateForm(entry));
  node.querySelector(".delete-btn").addEventListener("click", () => {
    entries = entries.filter((candidate) => candidate.id !== entry.id);
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
  ratingInput.value = entry.rating ?? "";
  syncStarRatingUI(entry.rating ?? null);
  document.getElementById("thc").value = entry.thc ?? "";
  document.getElementById("cbd").value = entry.cbd ?? "";
  document.getElementById("terpenes").value = entry.terpenes ?? "";
  document.getElementById("notes").value = entry.notes ?? "";
  renderCustomMetricInputs(entry.customPercentages ?? {});
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatStars(rating) {
  const value = sanitizeRating(rating);
  if (value === null) {
    return "Unrated";
  }
  return `${"★".repeat(value)}${"☆".repeat(5 - value)} (${value}/5)`;
}

function sanitizeRating(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.max(1, Math.min(5, Math.round(number)));
}

function sanitizePercent(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.max(0, Math.min(100, number));
}
