const BREEDING_STAT_NAMES = [
  "Vigor",
  "Fitness",
  "Physique",
  "Reflex",
  "Toughness",
  "Adaptation",
  "Instinct",
];

const LEGACY_BREEDING_STAT_MAP = {
  Vigor: ["Vigor", "Vitality"],
  Fitness: ["Fitness", "Endurance"],
  Physique: ["Physique", "Muscle"],
  Reflex: ["Reflex", "Agility"],
  Toughness: ["Toughness"],
  Adaptation: ["Adaptation", "Hardiness"],
  Instinct: ["Instinct", "Utility"],
};

const BLOODLINE_INFO = {
  Wild: {
    rarity: "common",
    summary: (level) => `+5% water and food use; +${Math.floor(level / 5)}% minor hemorrhage chance on hit`,
  },
  Brave: {
    rarity: "uncommon",
    summary: (level) => `-10% max stamina; +${Math.floor(level / 2)} melee damage`,
  },
  Careful: {
    rarity: "uncommon",
    summary: (level) => `-10% movement speed; -${level}% perceived threat`,
  },
  Timid: {
    rarity: "uncommon",
    summary: (level) => `-10% melee damage; +${level} movement speed`,
  },
  Bold: {
    rarity: "uncommon",
    summary: (level) => `-10 physical resistance; +${Math.floor(level / 2)} max stamina`,
  },
  Hardy: {
    rarity: "uncommon",
    summary: (level) => `+10% food use; +${Math.floor(level / 2)} health and +${level}% stamina regen`,
  },
  Stout: {
    rarity: "uncommon",
    summary: (level) => `+10% perceived threat; +${level}kg carry weight`,
  },
  Ambitious: {
    rarity: "uncommon",
    summary: () => "+50% experience gained",
  },
  Resolute: {
    rarity: "rare",
    summary: (level) => `-10% max health; +${level}% stamina regen and +${level}% fertilization recovery`,
  },
  Unstable: {
    rarity: "rare",
    summary: (level) => `-50% fertilization recovery speed; +${Math.floor(level / 2)}% genotype and phenotype mutation chance`,
  },
  Savage: {
    rarity: "rare",
    summary: (level) => `-50% health regen; +${level}% leech chance on hit`,
  },
  Alpha: {
    rarity: "legendary",
    summary: (level) => `+20% size; +${level} melee damage and +${level} max health`,
  },
};

function formatSex(value) {
  if (!Number.isFinite(value)) {
    return "n/a";
  }

  if (value === 1) {
    return "Female";
  }

  if (value === 2) {
    return "Male";
  }

  if (value === 0) {
    return "Unknown";
  }

  return String(value);
}

function formatPhenotype(stats) {
  if (Number.isFinite(stats.Variation)) {
    return String(stats.Variation);
  }

  return "n/a";
}

function formatBloodline(stats) {
  if (stats.Lineage) {
    return String(stats.Lineage);
  }

  if (stats.LineageName && stats.LineageName !== "None") {
    return String(stats.LineageName);
  }

  return "n/a";
}

function getMountSex(entry) {
  return formatSex(entry.decoded.stats.Sex);
}

function getMountBloodline(entry) {
  return formatBloodline(entry.decoded.stats);
}

function getMountPhenotype(entry) {
  return formatPhenotype(entry.decoded.stats);
}

function getBloodlineInfo(bloodline) {
  return BLOODLINE_INFO[bloodline] || null;
}

function getBloodlineRarity(bloodline) {
  return getBloodlineInfo(bloodline)?.rarity || "unknown";
}

function getBloodlineSummary(entry) {
  const bloodline = getMountBloodline(entry);
  const level = Number(entry.mount.MountLevel) || 0;
  const info = getBloodlineInfo(bloodline);
  return info ? info.summary(level) : "No bloodline bonus summary yet.";
}

function applyBloodlinePillStyles(node, bloodline) {
  if (!node) {
    return;
  }

  node.classList.remove("rarity-common", "rarity-uncommon", "rarity-rare", "rarity-legendary");
  node.classList.add(`rarity-${getBloodlineRarity(bloodline)}`);
}

const state = {
  sourceName: "",
  mountsData: null,
  mounts: [],
  originalMountCount: 0,
  activeView: "roster",
  draggedMountId: null,
  filters: {
    search: "",
    type: "",
    sex: "",
    bloodline: "",
    phenotype: "",
    pairingType: "",
    sort: "position",
  },
};

const elements = {
  fileInput: document.querySelector("#file-input"),
  exportButton: document.querySelector("#export-button"),
  exportCsvButton: document.querySelector("#export-csv-button"),
  searchInput: document.querySelector("#search-input"),
  typeFilter: document.querySelector("#type-filter"),
  sexFilter: document.querySelector("#sex-filter"),
  bloodlineFilter: document.querySelector("#bloodline-filter"),
  phenotypeFilter: document.querySelector("#phenotype-filter"),
  pairingTypeFilter: document.querySelector("#pairing-type-filter"),
  sortSelect: document.querySelector("#sort-select"),
  summaryCards: document.querySelector("#summary-cards"),
  mountList: document.querySelector("#mount-list"),
  pairingList: document.querySelector("#pairing-list"),
  emptyState: document.querySelector("#empty-state"),
  resultsMessage: document.querySelector("#results-message"),
  statusMessage: document.querySelector("#status-message"),
  mountCardTemplate: document.querySelector("#mount-card-template"),
  pairingCardTemplate: document.querySelector("#pairing-card-template"),
  orbitalList: document.querySelector("#orbital-list"),
  orbitalRowTemplate: document.querySelector("#orbital-row-template"),
  rosterViewButton: document.querySelector("#roster-view-button"),
  breedingViewButton: document.querySelector("#breeding-view-button"),
  orbitalViewButton: document.querySelector("#orbital-view-button"),
  breedingGuide: document.querySelector("#breeding-guide"),
  contentTitle: document.querySelector("#content-title"),
};

function initialize() {
  elements.fileInput.addEventListener("change", handleFileSelection);
  elements.exportButton.addEventListener("click", exportMountsJson);
  elements.exportCsvButton.addEventListener("click", exportMountsCsv);
  elements.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    render();
  });
  elements.typeFilter.addEventListener("change", (event) => {
    state.filters.type = event.target.value;
    render();
  });
  elements.sexFilter.addEventListener("change", (event) => {
    state.filters.sex = event.target.value;
    render();
  });
  elements.bloodlineFilter.addEventListener("change", (event) => {
    state.filters.bloodline = event.target.value;
    render();
  });
  elements.phenotypeFilter.addEventListener("change", (event) => {
    state.filters.phenotype = event.target.value;
    render();
  });
  elements.pairingTypeFilter.addEventListener("change", (event) => {
    state.filters.pairingType = event.target.value;
    render();
  });
  elements.sortSelect.addEventListener("change", (event) => {
    state.filters.sort = event.target.value;
    render();
  });
  elements.rosterViewButton.addEventListener("click", () => {
    state.activeView = "roster";
    render();
  });
  elements.breedingViewButton.addEventListener("click", () => {
    state.activeView = "breeding";
    render();
  });
  elements.orbitalViewButton.addEventListener("click", () => {
    state.activeView = "orbital";
    render();
  });
  render();
}

function handleFileSelection(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      loadMountsData(data, file.name);
      setStatus(`Loaded ${file.name}.`);
    } catch (error) {
      setStatus(`Import failed: ${error.message}`);
    }
  };
  reader.readAsText(file);
}

function loadMountsData(data, sourceName) {
  if (!data || !Array.isArray(data.SavedMounts)) {
    throw new Error("Expected a top-level SavedMounts array.");
  }

  state.sourceName = sourceName;
  state.mountsData = data;
  state.mounts = data.SavedMounts.map((mount, index) => normalizeMount(mount, index));
  state.originalMountCount = data.SavedMounts.length;
  state.filters.type = "";
  state.filters.sex = "";
  state.filters.bloodline = "";
  state.filters.phenotype = "";
  state.filters.pairingType = "";
  state.filters.search = "";
  state.filters.sort = "position";
  elements.searchInput.value = "";
  elements.sortSelect.value = "position";
  populateFilters();
  elements.exportButton.disabled = false;
  elements.exportCsvButton.disabled = false;
  render();
}

function normalizeMount(mount, index) {
  return {
    id: `${index}-${mount.DatabaseGUID || "noguid"}-${mount.MountName || "unnamed"}`,
    originalIndex: index,
    mount,
    deleted: false,
    decoded: decodeMountBlob(mount),
  };
}

function buildBreedingStatPlaceholder() {
  return BREEDING_STAT_NAMES.reduce((stats, name) => {
    stats[name] = null;
    return stats;
  }, {});
}

function decodeMountBlob(mount) {
  return window.IcarusBlobDecoder.decodeMountBlob(mount);
}

class BinaryReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = 0;
  }

  ensureAvailable(length) {
    if (this.offset + length > this.bytes.length) {
      throw new Error("Unexpected end of blob data.");
    }
  }

  readByte() {
    this.ensureAvailable(1);
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  readInt32() {
    this.ensureAvailable(4);
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readUInt32() {
    this.ensureAvailable(4);
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readInt64() {
    this.ensureAvailable(8);
    const value = Number(this.view.getBigInt64(this.offset, true));
    this.offset += 8;
    return value;
  }

  readFloat32() {
    this.ensureAvailable(4);
    const value = this.view.getFloat32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readBytes(length) {
    this.ensureAvailable(length);
    const value = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  readFString() {
    const length = this.readInt32();
    if (length === 0) {
      return "";
    }

    if (length < 0) {
      throw new Error("UTF-16 FString values are not yet supported.");
    }

    const byteLength = length;
    const raw = this.readBytes(byteLength);
    const content = raw.slice(0, Math.max(0, byteLength - 1));
    return new TextDecoder("utf-8").decode(content);
  }
}

function readProperties(reader, limitOffset = reader.bytes.length) {
  const properties = [];
  while (reader.offset < limitOffset) {
    const property = readProperty(reader);
    if (!property) {
      break;
    }
    properties.push(property);
  }
  return properties;
}

function readProperty(reader) {
  const name = reader.readFString();
  if (!name || name === "None") {
    return null;
  }

  const type = reader.readFString();
  const size = reader.readInt64();

  switch (type) {
    case "IntProperty":
      reader.readByte();
      return { name, type, value: reader.readInt32() };
    case "UInt32Property":
      reader.readByte();
      return { name, type, value: reader.readUInt32() };
    case "Int64Property":
      reader.readByte();
      return { name, type, value: reader.readInt64() };
    case "FloatProperty":
      reader.readByte();
      return { name, type, value: reader.readFloat32() };
    case "BoolProperty":
      return readBoolProperty(reader, name, type, size);
    case "StrProperty":
    case "NameProperty":
      reader.readByte();
      return { name, type, value: reader.readFString() };
    case "EnumProperty": {
      const enumType = reader.readFString();
      reader.readByte();
      return { name, type, enumType, value: reader.readFString() };
    }
    case "StructProperty":
      return readStructProperty(reader, name, type, size);
    case "ArrayProperty":
      return readArrayProperty(reader, name, type, size);
    default:
      return readUnknownProperty(reader, name, type, size);
  }
}

function readBoolProperty(reader, name, type, size) {
  const boolValue = reader.readByte() !== 0;
  if (size > 0) {
    reader.readBytes(size);
  }
  return { name, type, value: boolValue };
}

function readStructProperty(reader, name, type, size) {
  const structType = reader.readFString();
  reader.readBytes(17);

  if (structType === "Vector") {
    return {
      name,
      type,
      structType,
      value: {
        x: reader.readFloat32(),
        y: reader.readFloat32(),
        z: reader.readFloat32(),
      },
    };
  }

  if (structType === "Quat") {
    return {
      name,
      type,
      structType,
      value: {
        x: reader.readFloat32(),
        y: reader.readFloat32(),
        z: reader.readFloat32(),
        w: reader.readFloat32(),
      },
    };
  }

  if (structType === "LinearColor") {
    return {
      name,
      type,
      structType,
      value: {
        r: reader.readFloat32(),
        g: reader.readFloat32(),
        b: reader.readFloat32(),
        a: reader.readFloat32(),
      },
    };
  }

  const children = readProperties(reader);
  return { name, type, structType, children };
}

function readArrayProperty(reader, name, type, size) {
  const innerType = reader.readFString();
  reader.readByte();
  const count = reader.readInt32();
  const items = [];

  for (let index = 0; index < count; index += 1) {
    if (innerType === "StructProperty") {
      const property = readProperty(reader);
      if (!property) {
        break;
      }
      items.push(property);
      continue;
    }

    if (innerType === "IntProperty") {
      items.push(reader.readInt32());
      continue;
    }

    if (innerType === "UInt32Property") {
      items.push(reader.readUInt32());
      continue;
    }

    if (innerType === "FloatProperty") {
      items.push(reader.readFloat32());
      continue;
    }

    if (innerType === "NameProperty" || innerType === "StrProperty") {
      items.push(reader.readFString());
      continue;
    }

    throw new Error(`Unsupported ArrayProperty inner type: ${innerType}`);
  }

  return { name, type, innerType, items, size };
}

function readUnknownProperty(reader, name, type, size) {
  const raw = Array.from(reader.readBytes(size));
  return { name, type, raw };
}

function flattenPropertyValues(properties, output = {}) {
  for (const property of properties) {
    if (property.value !== undefined && output[property.name] === undefined) {
      output[property.name] = property.value;
    }

    if (property.children) {
      flattenPropertyValues(property.children, output);
    }

    if (property.items) {
      for (const item of property.items) {
        if (item && typeof item === "object") {
          if (item.children) {
            flattenPropertyValues(item.children, output);
          } else if (item.value !== undefined && item.name && output[item.name] === undefined) {
            output[item.name] = item.value;
          }
        }
      }
    }
  }

  return output;
}

function extractGeneticPairs(properties) {
  const geneticsArray = findProperty(properties, "Genetics");
  if (!geneticsArray || !Array.isArray(geneticsArray.items)) {
    return {};
  }

  const pairs = {};
  for (const item of geneticsArray.items) {
    const children = item.children || [];
    const name = getChildValue(children, "GeneticValueName");
    const value = getChildValue(children, "Value");
    if (name) {
      pairs[String(name)] = Number(value);
    }
  }

  return pairs;
}

function findProperty(properties, targetName) {
  for (const property of properties) {
    if (property.name === targetName) {
      return property;
    }

    if (property.children) {
      const nested = findProperty(property.children, targetName);
      if (nested) {
        return nested;
      }
    }

    if (property.items) {
      for (const item of property.items) {
        if (item && item.children) {
          const nested = findProperty(item.children, targetName);
          if (nested) {
            return nested;
          }
        }
      }
    }
  }

  return null;
}

function getChildValue(children, targetName) {
  const property = children.find((child) => child.name === targetName);
  return property ? property.value : undefined;
}

function mapBreedingStats(geneticPairs) {
  const breedingStats = buildBreedingStatPlaceholder();

  for (const [canonicalName, candidateNames] of Object.entries(LEGACY_BREEDING_STAT_MAP)) {
    for (const candidate of candidateNames) {
      if (geneticPairs[candidate] !== undefined) {
        breedingStats[canonicalName] = Number(geneticPairs[candidate]);
        break;
      }
    }
  }

  return breedingStats;
}

function populateFilters() {
  const previousValue = state.filters.type;
  const previousSex = state.filters.sex;
  const previousBloodline = state.filters.bloodline;
  const previousPhenotype = state.filters.phenotype;
  const previousPairingType = state.filters.pairingType;
  const activeMounts = state.mounts.filter((entry) => !entry.deleted);
  const types = [...new Set(activeMounts.map((entry) => entry.mount.MountType).filter(Boolean))].sort();
  const sexes = [...new Set(activeMounts.map(getMountSex).filter((value) => value && value !== "n/a"))].sort();
  const bloodlines = [...new Set(activeMounts.map(getMountBloodline).filter((value) => value && value !== "n/a"))].sort();
  const phenotypes = [...new Set(activeMounts.map(getMountPhenotype).filter((value) => value && value !== "n/a"))]
    .sort((left, right) => Number(left) - Number(right));

  elements.typeFilter.innerHTML = '<option value="">All types</option>';
  for (const type of types) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    elements.typeFilter.appendChild(option);
  }

  elements.typeFilter.value = types.includes(previousValue) ? previousValue : "";

  elements.sexFilter.innerHTML = '<option value="">All sexes</option>';
  for (const sex of sexes) {
    const option = document.createElement("option");
    option.value = sex;
    option.textContent = sex;
    elements.sexFilter.appendChild(option);
  }
  elements.sexFilter.value = sexes.includes(previousSex) ? previousSex : "";

  elements.bloodlineFilter.innerHTML = '<option value="">All bloodlines</option>';
  for (const bloodline of bloodlines) {
    const option = document.createElement("option");
    option.value = bloodline;
    option.textContent = bloodline;
    elements.bloodlineFilter.appendChild(option);
  }
  elements.bloodlineFilter.value = bloodlines.includes(previousBloodline) ? previousBloodline : "";

  elements.phenotypeFilter.innerHTML = '<option value="">All phenotypes</option>';
  for (const phenotype of phenotypes) {
    const option = document.createElement("option");
    option.value = phenotype;
    option.textContent = `P${phenotype}`;
    elements.phenotypeFilter.appendChild(option);
  }
  elements.phenotypeFilter.value = phenotypes.includes(previousPhenotype) ? previousPhenotype : "";

  elements.pairingTypeFilter.innerHTML = '<option value="">Use current type filter</option>';
  for (const type of types) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    elements.pairingTypeFilter.appendChild(option);
  }
  elements.pairingTypeFilter.value = types.includes(previousPairingType) ? previousPairingType : "";
}

function getVisibleMounts() {
  const search = state.filters.search;
  const type = state.filters.type;
  const sex = state.filters.sex;
  const bloodline = state.filters.bloodline;
  const phenotype = state.filters.phenotype;
  const filtered = state.mounts.filter((entry) => {
    if (entry.deleted) {
      return false;
    }
    const mount = entry.mount;
    const matchesSearch =
      !search ||
      String(mount.MountName || "").toLowerCase().includes(search) ||
      String(mount.MountType || "").toLowerCase().includes(search) ||
      getMountBloodline(entry).toLowerCase().includes(search) ||
      getMountPhenotype(entry).toLowerCase().includes(search) ||
      getMountSex(entry).toLowerCase().includes(search);
    const matchesType = !type || mount.MountType === type;
    const matchesSex = !sex || getMountSex(entry) === sex;
    const matchesBloodline = !bloodline || getMountBloodline(entry) === bloodline;
    const matchesPhenotype = !phenotype || getMountPhenotype(entry) === phenotype;
    return matchesSearch && matchesType && matchesSex && matchesBloodline && matchesPhenotype;
  });

  const sorted = [...filtered];
  switch (state.filters.sort) {
    case "name":
      sorted.sort((a, b) => compareText(a.mount.MountName, b.mount.MountName));
      break;
    case "type":
      sorted.sort((a, b) => compareText(a.mount.MountType, b.mount.MountType) || compareText(a.mount.MountName, b.mount.MountName));
      break;
    case "bloodline":
      sorted.sort((a, b) => compareText(getMountBloodline(a), getMountBloodline(b)) || compareText(a.mount.MountName, b.mount.MountName));
      break;
    case "phenotype":
      sorted.sort((a, b) => compareText(getMountPhenotype(a), getMountPhenotype(b)) || compareText(a.mount.MountName, b.mount.MountName));
      break;
    case "genetics-desc":
      sorted.sort((a, b) => (b.decoded.breedingTotal || 0) - (a.decoded.breedingTotal || 0));
      break;
    case "level-desc":
      sorted.sort((a, b) => (Number(b.mount.MountLevel) || 0) - (Number(a.mount.MountLevel) || 0));
      break;
    case "level-asc":
      sorted.sort((a, b) => (Number(a.mount.MountLevel) || 0) - (Number(b.mount.MountLevel) || 0));
      break;
    case "position":
    default:
      sorted.sort((a, b) => a.originalIndex - b.originalIndex);
      break;
  }

  return sorted;
}

function getRosterMounts() {
  const search = state.filters.search;
  const type = state.filters.type;
  const sex = state.filters.sex;
  const bloodline = state.filters.bloodline;
  const phenotype = state.filters.phenotype;
  const filtered = state.mounts.filter((entry) => {
    const mount = entry.mount;
    const matchesSearch =
      !search ||
      String(mount.MountName || "").toLowerCase().includes(search) ||
      String(mount.MountType || "").toLowerCase().includes(search) ||
      getMountBloodline(entry).toLowerCase().includes(search) ||
      getMountPhenotype(entry).toLowerCase().includes(search) ||
      getMountSex(entry).toLowerCase().includes(search);
    const matchesType = !type || mount.MountType === type;
    const matchesSex = !sex || getMountSex(entry) === sex;
    const matchesBloodline = !bloodline || getMountBloodline(entry) === bloodline;
    const matchesPhenotype = !phenotype || getMountPhenotype(entry) === phenotype;
    return matchesSearch && matchesType && matchesSex && matchesBloodline && matchesPhenotype;
  });

  const sorted = [...filtered];
  switch (state.filters.sort) {
    case "name":
      sorted.sort((a, b) => compareText(a.mount.MountName, b.mount.MountName));
      break;
    case "type":
      sorted.sort((a, b) => compareText(a.mount.MountType, b.mount.MountType) || compareText(a.mount.MountName, b.mount.MountName));
      break;
    case "bloodline":
      sorted.sort((a, b) => compareText(getMountBloodline(a), getMountBloodline(b)) || compareText(a.mount.MountName, b.mount.MountName));
      break;
    case "phenotype":
      sorted.sort((a, b) => compareText(getMountPhenotype(a), getMountPhenotype(b)) || compareText(a.mount.MountName, b.mount.MountName));
      break;
    case "genetics-desc":
      sorted.sort((a, b) => (b.decoded.breedingTotal || 0) - (a.decoded.breedingTotal || 0));
      break;
    case "level-desc":
      sorted.sort((a, b) => (Number(b.mount.MountLevel) || 0) - (Number(a.mount.MountLevel) || 0));
      break;
    case "level-asc":
      sorted.sort((a, b) => (Number(a.mount.MountLevel) || 0) - (Number(b.mount.MountLevel) || 0));
      break;
    case "position":
    default:
      sorted.sort((a, b) => a.originalIndex - b.originalIndex);
      break;
  }

  return sorted;
}

function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""));
}

function render() {
  renderSummary();
  renderViewState();
  renderMountList();
  renderPairingSuggestions();
  renderOrbitalList();
}

function renderSummary() {
  elements.summaryCards.innerHTML = "";

  if (!state.mounts.length) {
    const placeholder = document.createElement("p");
    placeholder.className = "muted";
    placeholder.textContent = "Summary cards will appear once data is loaded.";
    elements.summaryCards.appendChild(placeholder);
    elements.resultsMessage.textContent = "No mounts loaded yet.";
    return;
  }

  const visibleMounts = getVisibleMounts();
  const activeMounts = state.mounts.filter((entry) => !entry.deleted);
  const deletedCount = state.mounts.filter((entry) => entry.deleted).length;
  const cards = [
    { label: "Visible", value: visibleMounts.length },
    { label: "Total", value: activeMounts.length },
    { label: "Types", value: new Set(activeMounts.map((entry) => entry.mount.MountType)).size },
    { label: "Bloodlines", value: new Set(activeMounts.map(getMountBloodline).filter((value) => value !== "n/a")).size },
    { label: "Removed", value: deletedCount },
  ];

  for (const card of cards) {
    const node = document.createElement("div");
    node.className = "summary-card";
    node.innerHTML = `<strong>${card.value}</strong><span>${card.label}</span>`;
    elements.summaryCards.appendChild(node);
  }

  elements.resultsMessage.textContent = `${visibleMounts.length} of ${activeMounts.length} active mounts visible from ${state.sourceName || "current data"}.`;
}

function renderMountList() {
  const visibleMounts = getRosterMounts();
  elements.mountList.innerHTML = "";
  if (state.activeView !== "roster") {
    elements.mountList.hidden = true;
    return;
  }

  elements.mountList.hidden = false;
  elements.emptyState.hidden = visibleMounts.length > 0 || state.mounts.length > 0;

  if (!state.mounts.length) {
    return;
  }

  if (!visibleMounts.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<h3>No matches</h3><p>Try a broader search or reset the type filter.</p>";
    elements.mountList.appendChild(empty);
    return;
  }

  for (const entry of visibleMounts) {
    elements.mountList.appendChild(buildMountCard(entry));
  }
}

function renderOrbitalList() {
  elements.orbitalList.innerHTML = "";
  if (state.activeView !== "orbital") {
    elements.orbitalList.hidden = true;
    return;
  }

  elements.orbitalList.hidden = false;
  elements.emptyState.hidden = state.mounts.some((entry) => !entry.deleted);

  if (!state.mounts.some((entry) => !entry.deleted)) {
    return;
  }

  const orderedMounts = state.mounts.filter((entry) => !entry.deleted).sort((a, b) => a.originalIndex - b.originalIndex);
  for (const entry of orderedMounts) {
    elements.orbitalList.appendChild(buildOrbitalRow(entry));
  }
}

function renderViewState() {
  const rosterActive = state.activeView === "roster";
  const breedingActive = state.activeView === "breeding";
  const orbitalActive = state.activeView === "orbital";
  elements.rosterViewButton.classList.toggle("is-active", rosterActive);
  elements.breedingViewButton.classList.toggle("is-active", breedingActive);
  elements.orbitalViewButton.classList.toggle("is-active", orbitalActive);
  elements.breedingGuide.hidden = !breedingActive;
  elements.pairingList.closest("#pairing-panel").hidden = !breedingActive;
  elements.emptyState.hidden = state.mounts.length > 0;
  elements.contentTitle.textContent = rosterActive
    ? "Mount Roster"
    : breedingActive
      ? "Breeding Planner"
      : "Orbital Order";

  if (rosterActive) {
    elements.resultsMessage.textContent = state.mounts.length
      ? `${getVisibleMounts().length} of ${state.mounts.length} mounts visible from ${state.sourceName || "current data"}.`
      : "No mounts loaded yet.";
    return;
  }

  if (breedingActive) {
    elements.resultsMessage.textContent = state.mounts.length
      ? "Use the pair planner to compare same-species male and female mounts and decide which names to apply in game."
      : "No mounts loaded yet.";
    return;
  }

  elements.resultsMessage.textContent = state.mounts.length
    ? `${state.mounts.length} mounts in orbital call-down order. Reordering here changes their in-game orbital list.`
    : "No mounts loaded yet.";
}

function renderPairingSuggestions() {
  elements.pairingList.innerHTML = "";

  if (state.activeView !== "breeding" || !state.mounts.length) {
    return;
  }

  const pairingType = state.filters.pairingType || state.filters.type;
  const suggestions = getPairingCandidates(pairingType);

  if (!suggestions.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = pairingType
      ? `No suggested ${pairingType} pairs yet. Try a different mount type or clear the pair filter.`
      : "Choose or filter to a mount type to start seeing pair suggestions.";
    elements.pairingList.appendChild(empty);
    return;
  }

  for (const [index, suggestion] of suggestions.entries()) {
    elements.pairingList.appendChild(buildPairingCard(suggestion, index));
  }
}

function getPairingCandidates(pairingType) {
  if (!pairingType) {
    return [];
  }

  const species = state.mounts.filter((entry) => !entry.deleted && entry.mount.MountType === pairingType);
  const females = species.filter((entry) => getMountSex(entry) === "Female");
  const males = species.filter((entry) => getMountSex(entry) === "Male");
  const scoredPairs = [];

  for (const female of females) {
    for (const male of males) {
      scoredPairs.push(scorePair(female, male));
    }
  }

  scoredPairs.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return compareText(left.label, right.label);
  });

  return scoredPairs.slice(0, 8).map((pair, index) => {
    const pairTag = String.fromCharCode(65 + index);
    const phenotype = getMountPhenotype(pair.female) !== "n/a" ? getMountPhenotype(pair.female) : getMountPhenotype(pair.male);
    const bloodline = getMountBloodline(pair.female) !== "n/a" ? getMountBloodline(pair.female) : getMountBloodline(pair.male);
    return {
      ...pair,
      suggestedNames: {
        female: buildSuggestedPairName(pair.female, pairTag, phenotype, bloodline),
        male: buildSuggestedPairName(pair.male, pairTag, phenotype, bloodline),
      },
    };
  });
}

function scorePair(female, male) {
  const femaleStats = female.decoded.breedingStats;
  const maleStats = male.decoded.breedingStats;
  const femalePhenotype = getMountPhenotype(female);
  const malePhenotype = getMountPhenotype(male);
  const femaleBloodline = getMountBloodline(female);
  const maleBloodline = getMountBloodline(male);
  const notes = [];
  let score = 0;
  let strongCount = 0;
  let weakCount = 0;

  for (const statName of BREEDING_STAT_NAMES) {
    const femaleValue = Number.isFinite(femaleStats[statName]) ? femaleStats[statName] : 0;
    const maleValue = Number.isFinite(maleStats[statName]) ? maleStats[statName] : 0;
    const best = Math.max(femaleValue, maleValue);
    score += best;

    if (best >= 9) {
      strongCount += 1;
    }

    if (best <= 3) {
      weakCount += 1;
    }
  }

  if (femalePhenotype === malePhenotype && femalePhenotype !== "n/a") {
    score += 8;
    notes.push(`Shared phenotype P${femalePhenotype}`);
  } else {
    notes.push(`Phenotypes P${femalePhenotype} / P${malePhenotype}`);
  }

  if (femaleBloodline === maleBloodline && femaleBloodline !== "n/a") {
    score += 6;
    notes.push(`Shared bloodline ${femaleBloodline}`);
  } else {
    notes.push(`Bloodlines ${femaleBloodline} / ${maleBloodline}`);
  }

  notes.push(`${strongCount} standout stats at 9-10`);

  if (weakCount > 0) {
    notes.push(`${weakCount} low stats at 3 or below`);
  }

  const targetPhenotype = femalePhenotype !== "n/a" ? femalePhenotype : malePhenotype;
  const targetBloodline = femaleBloodline !== "n/a" ? femaleBloodline : maleBloodline;

  return {
    female,
    male,
    score,
    notes,
    label: `${female.mount.MountName || "Unnamed"} + ${male.mount.MountName || "Unnamed"}`,
    targetPhenotype,
    targetBloodline,
  };
}

function buildSuggestedPairName(entry, pairTag, phenotype, bloodline) {
  const sex = getMountSex(entry) === "Female" ? "F" : getMountSex(entry) === "Male" ? "M" : "U";
  const type = String(entry.mount.MountType || "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3);
  const parts = [sex];

  if (type) {
    parts.push(type);
  }

  if (phenotype && phenotype !== "n/a") {
    parts.push(`P${phenotype}`);
  }

  if (bloodline && bloodline !== "n/a") {
    parts.push(String(bloodline).slice(0, 5));
  }

  parts.push(`Pair ${pairTag}`);
  return sanitizeMountName(parts.join(" "));
}

function buildPairingCard(suggestion, index) {
  const fragment = elements.pairingCardTemplate.content.cloneNode(true);
  fragment.querySelector(".pairing-rank").textContent = `Suggested Pair ${index + 1}`;
  fragment.querySelector(".pairing-summary").textContent =
    buildPairingSummary(suggestion);

  const femalePanel = fragment.querySelector(".pairing-female");
  const malePanel = fragment.querySelector(".pairing-male");
  hydratePairingMount(femalePanel, suggestion.female, suggestion.suggestedNames.female);
  hydratePairingMount(malePanel, suggestion.male, suggestion.suggestedNames.male);

  const notes = fragment.querySelector(".pairing-notes");
  for (const note of suggestion.notes) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = note;
    notes.appendChild(pill);
  }

  return fragment;
}

function buildPairingSummary(suggestion) {
  const type = suggestion.female.mount.MountType || "mount";
  const phenotype = suggestion.targetPhenotype && suggestion.targetPhenotype !== "n/a" ? `P${suggestion.targetPhenotype}` : "mixed phenotypes";
  const bloodline = suggestion.targetBloodline && suggestion.targetBloodline !== "n/a" ? suggestion.targetBloodline : "mixed bloodlines";
  return `This ${type} pairing is best used when you want a stronger ${phenotype} ${bloodline} line.`;
}

function hydratePairingMount(container, entry, suggestedName) {
  container.querySelector(".pairing-mount-name").textContent = entry.mount.MountName || "Unnamed Mount";
  const pills = container.querySelector(".pairing-mount-pills");
  const pillValues = [
    entry.mount.MountType || "Unknown",
    getMountSex(entry),
    `P${getMountPhenotype(entry)}`,
    getMountBloodline(entry),
    `Total ${entry.decoded.breedingTotal || 0}`,
  ];

  for (const value of pillValues) {
    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = value;
    if (value === getMountBloodline(entry)) {
      applyBloodlinePillStyles(pill, value);
    }
    pills.appendChild(pill);
  }

  const input = container.querySelector(".pairing-name-input");
  input.value = suggestedName;
  const applyButton = container.querySelector(".pairing-apply-button");
  const resetButton = container.querySelector(".pairing-reset-button");

  applyButton.addEventListener("click", () => {
    const nextName = sanitizeMountName(input.value);
    entry.mount.MountName = nextName;
    input.value = nextName;
    render();
    setStatus(`Applied suggested name to ${entry.mount.MountType || "mount"}.`);
  });

  resetButton.addEventListener("click", () => {
    input.value = suggestedName;
  });
}

function buildMountCard(entry) {
  const mount = entry.mount;
  const fragment = elements.mountCardTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".mount-card");
  const title = fragment.querySelector(".mount-title");
  const positionBadge = fragment.querySelector(".position-badge");
  const nameInput = fragment.querySelector(".name-input");
  const typePill = fragment.querySelector(".type-pill");
  const levelPill = fragment.querySelector(".level-pill");
  const sexPill = fragment.querySelector(".sex-pill");
  const phenotypePill = fragment.querySelector(".phenotype-pill");
  const bloodlinePill = fragment.querySelector(".bloodline-pill");
  const geneticsPill = fragment.querySelector(".genetics-pill");
  const bloodlineBonusPill = fragment.querySelector(".bloodline-bonus-pill");
  const deleteButton = fragment.querySelector(".delete-button");
  const detailGrid = fragment.querySelector(".detail-grid");
  const breedingGrid = fragment.querySelector(".breeding-grid");

  const currentIndex = state.mounts.indexOf(entry);
  positionBadge.textContent = entry.deleted ? "Marked For Removal" : `Spawn Slot ${currentIndex + 1}`;
  title.textContent = mount.MountName || "Unnamed Mount";
  nameInput.value = mount.MountName || "";
  typePill.textContent = mount.MountType || "Unknown Type";
  levelPill.textContent = `Level ${Number(mount.MountLevel) || 0}`;
  sexPill.textContent = getMountSex(entry);
  phenotypePill.textContent = `P${getMountPhenotype(entry)}`;
  bloodlinePill.textContent = `Bloodline ${getMountBloodline(entry)}`;
  applyBloodlinePillStyles(bloodlinePill, getMountBloodline(entry));
  geneticsPill.textContent = `Total ${Number.isFinite(entry.decoded.breedingTotal) ? entry.decoded.breedingTotal : "n/a"}`;
  bloodlineBonusPill.textContent = `Bloodline Bonus: ${getBloodlineSummary(entry)}`;
  applyBloodlinePillStyles(bloodlineBonusPill, getMountBloodline(entry));
  card.classList.toggle("is-deleted", entry.deleted);
  nameInput.disabled = entry.deleted;

  const details = [
    ["Type", mount.MountType || "Unknown"],
    ["Level", Number(mount.MountLevel) || 0],
    ["Sex", getMountSex(entry)],
    ["Phenotype", getMountPhenotype(entry)],
    ["Bloodline", getMountBloodline(entry)],
    ["Experience", entry.decoded.stats.Experience ?? "n/a"],
    ["Current Health", entry.decoded.stats.CurrentHealth ?? "n/a"],
    ["Mother", entry.decoded.stats.MotherName || "Unknown"],
    ["Father", entry.decoded.stats.FatherName || "Unknown"],
  ];

  for (const [label, value] of details) {
    const item = document.createElement("div");
    item.className = "detail-item";
    item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    detailGrid.appendChild(item);
  }

  for (const statName of BREEDING_STAT_NAMES) {
    const statValue = entry.decoded.breedingStats[statName];
    const item = document.createElement("div");
    item.className = "breeding-stat";
    item.innerHTML = `<span>${statName}</span><strong>${Number.isFinite(statValue) ? statValue : "n/a"}</strong>`;
    breedingGrid.appendChild(item);
  }

  if (entry.decoded.decodeError) {
    const errorMessage = document.createElement("p");
    errorMessage.className = "muted";
    errorMessage.textContent = `Decode note: ${entry.decoded.decodeError}`;
    breedingGrid.after(errorMessage);
  }

  nameInput.addEventListener("change", (event) => {
    mount.MountName = sanitizeMountName(event.target.value);
    title.textContent = mount.MountName || "Unnamed Mount";
    event.target.value = mount.MountName;
    setStatus(`Renamed mount in slot ${currentIndex + 1}.`);
  });

  deleteButton.textContent = entry.deleted ? "Undo Delete" : "Delete";
  deleteButton.classList.toggle("ghost", entry.deleted);
  deleteButton.classList.toggle("danger", !entry.deleted);
  deleteButton.addEventListener("click", () => {
    toggleMountDeleted(entry.id);
  });

  card.dataset.mountId = entry.id;
  return fragment;
}

function buildOrbitalRow(entry) {
  const mount = entry.mount;
  const fragment = elements.orbitalRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".orbital-row");
  const handle = fragment.querySelector(".orbital-handle");
  const currentIndex = state.mounts.indexOf(entry);
  fragment.querySelector(".orbital-slot").textContent = `Orbital Slot ${currentIndex + 1}`;
  fragment.querySelector(".orbital-title").textContent = mount.MountName || "Unnamed Mount";
  fragment.querySelector(".orbital-type").textContent = mount.MountType || "Unknown Type";
  fragment.querySelector(".orbital-level").textContent = `Level ${Number(mount.MountLevel) || 0}`;
  fragment.querySelector(".orbital-sex").textContent = getMountSex(entry);
  fragment.querySelector(".orbital-pheno").textContent = `P${getMountPhenotype(entry)}`;
  const orbitalBloodline = fragment.querySelector(".orbital-bloodline");
  orbitalBloodline.textContent = getMountBloodline(entry);
  applyBloodlinePillStyles(orbitalBloodline, getMountBloodline(entry));
  fragment.querySelector(".orbital-total").textContent = `Total ${entry.decoded.breedingTotal || 0}`;

  row.dataset.mountId = entry.id;
  handle.draggable = true;
  handle.addEventListener("dragstart", (event) => {
    state.draggedMountId = entry.id;
    row.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", entry.id);
  });
  row.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (state.draggedMountId && state.draggedMountId !== entry.id) {
      row.classList.add("is-drop-target");
      event.dataTransfer.dropEffect = "move";
    }
  });
  row.addEventListener("dragleave", () => {
    row.classList.remove("is-drop-target");
  });
  row.addEventListener("drop", (event) => {
    event.preventDefault();
    row.classList.remove("is-drop-target");
    moveMountById(state.draggedMountId, entry.id);
  });
  row.addEventListener("dragend", () => {
    state.draggedMountId = null;
    cleanupOrbitalDragState();
  });
  return fragment;
}

function sanitizeMountName(value) {
  return String(value || "").trim().slice(0, 30);
}

function moveMount(fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= state.mounts.length || fromIndex === toIndex) {
    return;
  }

  const [entry] = state.mounts.splice(fromIndex, 1);
  state.mounts.splice(toIndex, 0, entry);
  syncSavedMounts();
  render();
  setStatus(`Moved mount to spawn slot ${toIndex + 1}.`);
}

function moveMountById(draggedId, targetId) {
  if (!draggedId || !targetId || draggedId === targetId) {
    cleanupOrbitalDragState();
    return;
  }

  const draggedIndex = state.mounts.findIndex((entry) => entry.id === draggedId);
  const targetIndex = state.mounts.findIndex((entry) => entry.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) {
    cleanupOrbitalDragState();
    return;
  }

  const [entry] = state.mounts.splice(draggedIndex, 1);
  const adjustedTargetIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
  state.mounts.splice(adjustedTargetIndex, 0, entry);
  syncSavedMounts();
  render();
  setStatus(`Moved mount to orbital slot ${adjustedTargetIndex + 1}.`);
  cleanupOrbitalDragState();
}

function cleanupOrbitalDragState() {
  document.querySelectorAll(".orbital-row").forEach((node) => {
    node.classList.remove("is-drop-target", "is-dragging");
  });
}

function removeMount(entryId) {
  const entry = state.mounts.find((candidate) => candidate.id === entryId);
  if (!entry) {
    return;
  }

  entry.deleted = true;
  populateFilters();
  render();
  setStatus("Marked mount for removal. Export JSON to apply the deletion.");
}

function toggleMountDeleted(entryId) {
  const entry = state.mounts.find((candidate) => candidate.id === entryId);
  if (!entry) {
    return;
  }

  entry.deleted = !entry.deleted;
  populateFilters();
  render();
  setStatus(entry.deleted ? "Marked mount for removal. Export JSON to apply the deletion." : "Restored mount to the working set.");
}

function syncSavedMounts() {
  if (!state.mountsData) {
    return;
  }

  state.mounts.forEach((entry, index) => {
    entry.originalIndex = index;
  });
}

function exportMountsJson() {
  if (!state.mountsData) {
    return;
  }

  const exportData = {
    ...state.mountsData,
    SavedMounts: state.mounts.filter((entry) => !entry.deleted).map((entry) => entry.mount),
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildExportFileName();
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus(`Exported ${anchor.download}.`);
}

function exportMountsCsv() {
  if (!state.mountsData) {
    return;
  }

  const rows = buildCsvRows();
  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = buildExportCsvFileName();
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus(`Exported ${anchor.download}.`);
}

function buildCsvRows() {
  const header = [
    "OrbitalSlot",
    "MountName",
    "MountType",
    "MountLevel",
    "Sex",
    "Phenotype",
    "Bloodline",
    "BloodlineBonus",
    "GeneticsTotal",
    "Vigor",
    "Fitness",
    "Physique",
    "Reflex",
    "Toughness",
    "Adaptation",
    "Instinct",
    "Experience",
    "CurrentHealth",
    "MotherName",
    "FatherName",
  ];

  const activeMounts = state.mounts.filter((entry) => !entry.deleted);
  const rows = [header];

  for (const [index, entry] of activeMounts.entries()) {
    rows.push([
      index + 1,
      entry.mount.MountName || "",
      entry.mount.MountType || "",
      Number(entry.mount.MountLevel) || 0,
      getMountSex(entry),
      getMountPhenotype(entry),
      getMountBloodline(entry),
      getBloodlineSummary(entry),
      Number.isFinite(entry.decoded.breedingTotal) ? entry.decoded.breedingTotal : "",
      formatCsvStat(entry.decoded.breedingStats.Vigor),
      formatCsvStat(entry.decoded.breedingStats.Fitness),
      formatCsvStat(entry.decoded.breedingStats.Physique),
      formatCsvStat(entry.decoded.breedingStats.Reflex),
      formatCsvStat(entry.decoded.breedingStats.Toughness),
      formatCsvStat(entry.decoded.breedingStats.Adaptation),
      formatCsvStat(entry.decoded.breedingStats.Instinct),
      entry.decoded.stats.Experience ?? "",
      entry.decoded.stats.CurrentHealth ?? "",
      entry.decoded.stats.MotherName || "",
      entry.decoded.stats.FatherName || "",
    ]);
  }

  return rows;
}

function formatCsvStat(value) {
  return Number.isFinite(value) ? value : "";
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function buildExportFileName() {
  return "Mounts.json";
}

function buildExportCsvFileName() {
  if (!state.sourceName) {
    return "Mounts.export.csv";
  }

  if (state.sourceName.toLowerCase().endsWith(".json")) {
    return state.sourceName.replace(/\.json$/i, ".export.csv");
  }

  return `${state.sourceName}.export.csv`;
}

function setStatus(message) {
  elements.statusMessage.textContent = message;
}

initialize();
