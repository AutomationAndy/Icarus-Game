(function attachIcarusBlobDecoder(global) {
  const DECODER_VERSION = "decoder-2026-04-15-struct-boundary-v1";
  const LEGACY_BREEDING_STAT_MAP = {
    Vigor: ["Vigor", "Vitality"],
    Fitness: ["Fitness", "Endurance"],
    Physique: ["Physique", "Muscle"],
    Reflex: ["Reflex", "Agility"],
    Toughness: ["Toughness"],
    Adaptation: ["Adaptation", "Hardiness"],
    Instinct: ["Instinct", "Utility"],
  };

  const BREEDING_STAT_NAMES = Object.keys(LEGACY_BREEDING_STAT_MAP);

  function buildBreedingStatPlaceholder() {
    return BREEDING_STAT_NAMES.reduce((stats, name) => {
      stats[name] = null;
      return stats;
    }, {});
  }

  function decodeMountBlob(mount) {
    const bytes = mount?.RecorderBlob?.BinaryData;
    return decodeBinaryData(bytes);
  }

  function decodeBinaryData(bytes) {
    if (!Array.isArray(bytes) || !bytes.length) {
      return {
        version: DECODER_VERSION,
        properties: [],
        breedingStats: buildBreedingStatPlaceholder(),
        breedingTotal: null,
        flatValues: {},
        parseTrace: [],
        parserDebug: {},
        stats: {},
        geneticsSource: {},
        decodeError: "Missing BinaryData",
      };
    }

    try {
      const reader = new BinaryReader(Uint8Array.from(bytes));
      const properties = readProperties(reader);
      const scanned = scanKnownValues(bytes);
      const flatValues = { ...flattenPropertyValues(properties), ...scanned.stats };
      const geneticPairs = Object.keys(scanned.geneticsSource).length
        ? scanned.geneticsSource
        : extractGeneticPairs(properties);
      const breedingStats = mapBreedingStats(geneticPairs);
      const populatedValues = Object.values(breedingStats).filter((value) => Number.isFinite(value));
      const breedingTotal = populatedValues.length ? populatedValues.reduce((total, value) => total + value, 0) : null;

      return {
        version: DECODER_VERSION,
        properties,
        breedingStats,
        breedingTotal,
        geneticsSource: geneticPairs,
        flatValues,
        parseTrace: reader.parseTrace,
        stats: {
          Experience: flatValues.Experience,
          FoodLevel: flatValues.FoodLevel,
          WaterLevel: flatValues.WaterLevel,
          OxygenLevel: flatValues.OxygenLevel,
          Stamina: flatValues.Stamina,
          CurrentHealth: flatValues.CurrentHealth,
          OwnerName: flatValues.OwnerName,
          AISetupRowName: flatValues.AISetupRowName,
          Sex: flatValues.Sex,
          Variation: flatValues.Variation,
          UniqueVariation: flatValues.UniqueVariation,
          Lineage: flatValues.Lineage,
          LineageName: flatValues.LineageName,
          MotherName: flatValues.MotherName,
          FatherName: flatValues.FatherName,
          bHasGeneratedGenetics: flatValues.bHasGeneratedGenetics,
        },
        parserProgress: {
          parsedOffset: reader.offset,
          totalBytes: bytes.length,
          remainingBytes: Math.max(0, bytes.length - reader.offset),
          tailHexPreview: bytesToHex(bytes.slice(reader.offset, Math.min(bytes.length, reader.offset + 256))),
        },
        parserDebug: buildParserDebug(reader.parseTrace, bytes, reader.offset),
        scanDebug: scanned.debug,
        decodeError: null,
      };
    } catch (error) {
      const scanned = scanKnownValues(bytes);
      const breedingStats = mapBreedingStats(scanned.geneticsSource);
      const populatedValues = Object.values(breedingStats).filter((value) => Number.isFinite(value));
      const errorOffset = Number.isFinite(error?.parseOffset) ? error.parseOffset : 0;
      return {
        version: DECODER_VERSION,
        properties: [],
        breedingStats,
        breedingTotal: populatedValues.length ? populatedValues.reduce((total, value) => total + value, 0) : null,
        stats: scanned.stats,
        geneticsSource: scanned.geneticsSource,
        flatValues: scanned.stats,
        parseTrace: error.parseTrace || [],
        parserProgress: {
          parsedOffset: errorOffset,
          totalBytes: bytes.length,
          remainingBytes: Math.max(0, bytes.length - errorOffset),
          tailHexPreview: bytesToHex(bytes.slice(errorOffset, Math.min(bytes.length, errorOffset + 256))),
        },
        parserDebug: buildParserDebug(error.parseTrace || [], bytes, errorOffset),
        scanDebug: scanned.debug,
        decodeError: `${error.message} Falling back to byte scan.`,
      };
    }
  }

  class BinaryReader {
    constructor(bytes) {
      this.bytes = bytes;
      this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      this.offset = 0;
      this.textDecoder = new TextDecoder("utf-8");
      this.parseTrace = [];
    }

    ensureAvailable(length) {
      if (this.offset + length > this.bytes.length) {
        const error = new Error("Unexpected end of blob data.");
        error.parseOffset = this.offset;
        throw error;
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

      const raw = this.readBytes(length);
      const content = raw.slice(0, Math.max(0, length - 1));
      return this.textDecoder.decode(content);
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
    const propertyStart = reader.offset;
    const name = reader.readFString();
    if (!name || name === "None") {
      return null;
    }

    const type = reader.readFString();
    const size = reader.readInt32();
    const arrayIndex = reader.readInt32();
    const traceIndex = reader.parseTrace.push({
      start: propertyStart,
      name,
      type,
      size,
      arrayIndex,
      afterHeader: reader.offset,
    }) - 1;

    try {
      let property;
      switch (type) {
        case "IntProperty":
          reader.readByte();
          property = { name, type, size, arrayIndex, value: reader.readInt32() };
          break;
        case "UInt32Property":
          reader.readByte();
          property = { name, type, size, arrayIndex, value: reader.readUInt32() };
          break;
        case "Int64Property":
          reader.readByte();
          property = { name, type, size, arrayIndex, value: reader.readInt64() };
          break;
        case "FloatProperty":
          reader.readByte();
          property = { name, type, size, arrayIndex, value: reader.readFloat32() };
          break;
        case "BoolProperty":
          property = readBoolProperty(reader, name, type, size, arrayIndex);
          break;
        case "StrProperty":
        case "NameProperty":
          reader.readByte();
          property = { name, type, size, arrayIndex, value: reader.readFString() };
          break;
        case "EnumProperty":
          property = readEnumProperty(reader, name, type, size, arrayIndex);
          break;
        case "StructProperty":
          property = readStructProperty(reader, name, type, size, arrayIndex);
          break;
        case "ArrayProperty":
          property = readArrayProperty(reader, name, type, size, arrayIndex);
          break;
        default:
          property = readUnknownProperty(reader, name, type, size, arrayIndex);
          break;
      }

      reader.parseTrace[traceIndex].end = reader.offset;
      return property;
    } catch (error) {
      error.parseOffset = Number.isFinite(error.parseOffset) ? error.parseOffset : reader.offset;
      reader.parseTrace[traceIndex].failedAt = error.parseOffset;
      reader.parseTrace[traceIndex].error = error.message;
      error.parseTrace = reader.parseTrace;
      throw error;
    }
  }

  function readBoolProperty(reader, name, type, size, arrayIndex) {
    const value = reader.readByte() !== 0;
    reader.readByte();
    return { name, type, size, arrayIndex, value };
  }

  function readEnumProperty(reader, name, type, size, arrayIndex) {
    const enumType = reader.readFString();
    reader.readByte();
    const value = reader.readFString();
    return { name, type, size, arrayIndex, enumType, value };
  }

  function readStructProperty(reader, name, type, size, arrayIndex) {
    const structType = reader.readFString();
    reader.readBytes(16);
    reader.readByte();
    const payloadStart = reader.offset;
    const payloadEnd = Math.min(reader.bytes.length, payloadStart + size);

    if (structType === "Vector") {
      const property = {
        name,
        type,
        size,
        arrayIndex,
        structType,
        value: {
          x: reader.readFloat32(),
          y: reader.readFloat32(),
          z: reader.readFloat32(),
        },
      };
      reader.offset = payloadEnd;
      return property;
    }

    if (structType === "Quat") {
      const property = {
        name,
        type,
        size,
        arrayIndex,
        structType,
        value: {
          x: reader.readFloat32(),
          y: reader.readFloat32(),
          z: reader.readFloat32(),
          w: reader.readFloat32(),
        },
      };
      reader.offset = payloadEnd;
      return property;
    }

    if (structType === "LinearColor") {
      const property = {
        name,
        type,
        size,
        arrayIndex,
        structType,
        value: {
          r: reader.readFloat32(),
          g: reader.readFloat32(),
          b: reader.readFloat32(),
          a: reader.readFloat32(),
        },
      };
      reader.offset = payloadEnd;
      return property;
    }

    const children = readProperties(reader, payloadEnd);
    reader.offset = payloadEnd;
    return { name, type, size, arrayIndex, structType, children, debug: { payloadStart, payloadEnd } };
  }

  function readArrayProperty(reader, name, type, size, arrayIndex) {
    const innerType = reader.readFString();
    reader.readByte();
    const payloadStart = reader.offset;
    const payloadEnd = Math.min(reader.bytes.length, payloadStart + size);
    const count = reader.readInt32();
    const items = [];

    if (innerType === "StructProperty") {
      const prototype = readPropertyTag(reader);
      for (let index = 0; index < count; index += 1) {
        const itemOffset = reader.offset;
        const itemChildren = readProperties(reader, payloadEnd);
        items.push({
          name: prototype?.name || name,
          type: "StructProperty",
          structType: prototype?.structType || null,
          arrayItemIndex: index,
          arrayItemOffset: itemOffset,
          children: itemChildren,
        });
      }

      reader.offset = payloadEnd;
      return {
        name,
        type,
        size,
        arrayIndex,
        innerType,
        elemName: prototype?.name || null,
        structType: prototype?.structType || null,
        items,
        debug: { payloadStart, payloadEnd, count },
      };
    }

    for (let index = 0; index < count; index += 1) {
      if (reader.offset >= payloadEnd) {
        break;
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

    reader.offset = payloadEnd;
    return { name, type, size, arrayIndex, innerType, items, debug: { payloadStart, payloadEnd, count } };
  }

  function readUnknownProperty(reader, name, type, size, arrayIndex) {
    const raw = Array.from(reader.readBytes(size));
    return { name, type, size, arrayIndex, raw };
  }

  function readPropertyTag(reader) {
    if (reader.remaining < 4) {
      return null;
    }

    const name = reader.readFString();
    if (!name || name === "None") {
      return null;
    }

    const type = reader.readFString();
    const size = reader.readInt32();
    const arrayIndex = reader.readInt32();
    const tag = { name, type, size, arrayIndex };

    if (type === "StructProperty") {
      tag.structType = reader.readFString();
      reader.readBytes(16);
    } else if (type === "ArrayProperty") {
      tag.innerType = reader.readFString();
    } else if (type === "EnumProperty") {
      tag.enumType = reader.readFString();
    }

    reader.readByte();
    return tag;
  }

  function flattenPropertyValues(properties, output = {}) {
    for (const property of properties) {
      const currentValue = output[property.name];
      const nextValue = property.value;
      const shouldReplace =
        currentValue === undefined ||
        currentValue === null ||
        currentValue === "" ||
        currentValue === "None";

      if (nextValue !== undefined && shouldReplace) {
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
    const pairs = {};
    const orderedProperties = flattenPropertiesInOrder(properties);

    for (let index = 0; index < orderedProperties.length; index += 1) {
      const property = orderedProperties[index];
      if (property.name !== "GeneticValueName") {
        continue;
      }

      for (let lookahead = index + 1; lookahead < orderedProperties.length; lookahead += 1) {
        const candidate = orderedProperties[lookahead];
        if (candidate.name === "GeneticValueName") {
          break;
        }

        if (candidate.name === "Value" && candidate.type === "IntProperty") {
          pairs[String(property.value)] = Number(candidate.value);
          break;
        }
      }
    }

    const geneticsArray = findProperty(properties, "Genetics");
    if (geneticsArray && Array.isArray(geneticsArray.items)) {
      for (const item of geneticsArray.items) {
        const children = item.children || [];
        const name = getChildValue(children, "GeneticValueName");
        const value = getChildValue(children, "Value");
        if (name !== undefined) {
          pairs[String(name)] = Number(value);
        }
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

  function flattenPropertiesInOrder(properties, output = []) {
    for (const property of properties) {
      output.push(property);

      if (property.children) {
        flattenPropertiesInOrder(property.children, output);
      }

      if (property.items) {
        for (const item of property.items) {
          if (item && typeof item === "object" && item.name) {
            output.push(item);
            if (item.children) {
              flattenPropertiesInOrder(item.children, output);
            }
          }
        }
      }
    }

    return output;
  }

  function getChildValue(children, targetName) {
    const property = children.find((child) => child.name === targetName);
    return property ? property.value : undefined;
  }

  function mapBreedingStats(geneticPairs) {
    const breedingStats = buildBreedingStatPlaceholder();
    for (const [canonicalName, candidateNames] of Object.entries(LEGACY_BREEDING_STAT_MAP)) {
      for (const candidateName of candidateNames) {
        if (geneticPairs[candidateName] !== undefined) {
          breedingStats[canonicalName] = Number(geneticPairs[candidateName]);
          break;
        }
      }
    }
    return breedingStats;
  }

  function propertyTreeToPlain(properties) {
    return properties.map((property) => {
      const plain = {
        name: property.name,
        type: property.type,
      };

      if (property.structType) {
        plain.structType = property.structType;
      }

      if (property.innerType) {
        plain.innerType = property.innerType;
      }

      if (property.enumType) {
        plain.enumType = property.enumType;
      }

      if (property.value !== undefined) {
        plain.value = property.value;
      }

      if (property.raw) {
        plain.raw = property.raw;
      }

      if (property.children) {
        plain.children = propertyTreeToPlain(property.children);
      }

      if (property.items) {
        plain.items = property.items.map((item) => {
          if (item && typeof item === "object" && item.name) {
            return propertyTreeToPlain([item])[0];
          }
          return item;
        });
      }

      return plain;
    });
  }

  function scanKnownValues(bytes) {
    const data = Uint8Array.from(bytes);
    const geneticsSource = {};
    const stats = {};
    const debug = {
      geneticOffsets: [],
      statOffsets: {},
    };

    const statNames = ["Experience", "FoodLevel", "WaterLevel", "OxygenLevel", "Stamina", "CurrentHealth"];
    for (const statName of statNames) {
      const parsed = scanIntProperty(data, statName);
      if (parsed) {
        stats[statName] = parsed.value;
        debug.statOffsets[statName] = parsed.offset;
      }
    }

    const offsets = findAsciiOffsets(data, "GeneticValueName");
    debug.geneticOffsets = offsets;
    for (const offset of offsets) {
      const pair = parseGeneticPairAtOffset(data, offset);
      if (pair) {
        geneticsSource[pair.name] = pair.value;
      }
    }

    return { geneticsSource, stats, debug };
  }

  function scanIntProperty(bytes, propertyName) {
    const offsets = findAsciiOffsets(bytes, propertyName);
    for (const offset of offsets) {
      const property = parsePropertyFromNameOffset(bytes, offset);
      if (property && property.name === propertyName && property.type === "IntProperty" && Number.isFinite(property.value)) {
        return { value: property.value, offset };
      }
    }
    return null;
  }

  function parseGeneticPairAtOffset(bytes, offset) {
    const geneticName = parsePropertyFromNameOffset(bytes, offset);
    if (!geneticName || geneticName.name !== "GeneticValueName") {
      return null;
    }

    const nextOffset = geneticName.nextOffset;
    const valueNameOffset = locatePropertyNameAtOffset(bytes, nextOffset);
    if (valueNameOffset === null) {
      return null;
    }

    const valueProperty = parsePropertyFromNameOffset(bytes, valueNameOffset);
    if (!valueProperty || valueProperty.name !== "Value") {
      return null;
    }

    return {
      name: String(geneticName.value),
      value: Number(valueProperty.value),
    };
  }

  function parsePropertyFromNameOffset(bytes, nameOffset) {
    const name = readCStringAt(bytes, nameOffset);
    if (!name) {
      return null;
    }

    const nameLengthOffset = nameOffset - 4;
    if (nameLengthOffset < 0) {
      return null;
    }

    const declaredNameLength = readInt32From(bytes, nameLengthOffset);
    if (declaredNameLength !== name.length + 1) {
      return null;
    }

    let cursor = nameOffset + name.length + 1;
    const typeLength = readInt32From(bytes, cursor);
    if (!Number.isFinite(typeLength) || typeLength <= 0 || typeLength > 128) {
      return null;
    }
    cursor += 4;

    const type = readStringWithKnownLength(bytes, cursor, typeLength);
    if (!type) {
      return null;
    }
    cursor += typeLength;

    const size = readInt32From(bytes, cursor);
    cursor += 4;
    const arrayIndex = readInt32From(bytes, cursor);
    cursor += 4;

    if (type === "IntProperty") {
      cursor += 1;
      const value = readInt32From(bytes, cursor);
      cursor += 4;
      return { name, type, size, arrayIndex, value, nextOffset: cursor };
    }

    if (type === "NameProperty" || type === "StrProperty") {
      cursor += 1;
      const valueLength = readInt32From(bytes, cursor);
      cursor += 4;
      const value = readStringWithKnownLength(bytes, cursor, valueLength);
      cursor += valueLength;
      return { name, type, size, arrayIndex, value, nextOffset: cursor };
    }

    if (type === "BoolProperty") {
      const value = bytes[cursor] !== 0;
      cursor += 2;
      return { name, type, size, arrayIndex, value, nextOffset: cursor };
    }

    return null;
  }

  function locatePropertyNameAtOffset(bytes, offset) {
    if (offset + 4 > bytes.length) {
      return null;
    }

    const length = readInt32From(bytes, offset);
    if (!Number.isFinite(length) || length <= 0 || offset + 4 + length > bytes.length) {
      return null;
    }

    return offset + 4;
  }

  function findAsciiOffsets(bytes, text) {
    const target = Array.from(new TextEncoder().encode(`${text}\0`));
    const offsets = [];

    for (let i = 0; i <= bytes.length - target.length; i += 1) {
      let matched = true;
      for (let j = 0; j < target.length; j += 1) {
        if (bytes[i + j] !== target[j]) {
          matched = false;
          break;
        }
      }
      if (matched) {
        offsets.push(i);
      }
    }

    return offsets;
  }

  function readCStringAt(bytes, offset) {
    let end = offset;
    while (end < bytes.length && bytes[end] !== 0) {
      end += 1;
    }
    if (end >= bytes.length) {
      return "";
    }
    return new TextDecoder("utf-8").decode(bytes.slice(offset, end));
  }

  function readStringWithKnownLength(bytes, offset, length) {
    if (!Number.isFinite(length) || length <= 0 || offset + length > bytes.length) {
      return "";
    }
    return new TextDecoder("utf-8").decode(bytes.slice(offset, offset + length - 1));
  }

  function readInt32From(bytes, offset) {
    if (offset < 0 || offset + 4 > bytes.length) {
      return NaN;
    }
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(offset, true);
  }

  function bytesToHex(bytes) {
    return Array.from(bytes)
      .map((value) => value.toString(16).padStart(2, "0"))
      .join(" ");
  }

  function bytesToAscii(bytes) {
    return Array.from(bytes)
      .map((value) => {
        if (value >= 32 && value <= 126) {
          return String.fromCharCode(value);
        }
        return ".";
      })
      .join("");
  }

  function buildParserDebug(parseTrace, bytes, failureOffset) {
    const lastGoodProperty = [...parseTrace].reverse().find((entry) => entry.end !== undefined) || null;
    const failingProperty = [...parseTrace].reverse().find((entry) => entry.failedAt !== undefined) || null;
    const previewStart = Math.max(0, failureOffset - 48);
    const previewEnd = Math.min(bytes.length, failureOffset + 160);
    const previewBytes = bytes.slice(previewStart, previewEnd);

    return {
      lastGoodProperty,
      failingProperty,
      failureOffset,
      asciiPreview: bytesToAscii(previewBytes),
      hexPreview: bytesToHex(previewBytes),
    };
  }

  global.IcarusBlobDecoder = {
    version: DECODER_VERSION,
    buildBreedingStatPlaceholder,
    decodeMountBlob,
    decodeBinaryData,
    propertyTreeToPlain,
  };
})(window);
