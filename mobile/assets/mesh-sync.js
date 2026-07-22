(() => {
  "use strict";

  const PROTOCOL = 1;
  const MAX_OPERATIONS = 50000;
  const MAX_DEVICES = 64;
  // A 47 MiB plaintext envelope remains below the 64 MiB transport frame after AES-GCM and base64 wrapping.
  const MAX_ENVELOPE_BYTES = 47 * 1024 * 1024;
  const MAX_OPERATION_BYTES = 4 * 1024 * 1024;
  const MAX_PAYLOAD_DEPTH = 16;
  const MAX_PAYLOAD_NODES = 20000;
  const RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
  const COLLECTIONS = new Set([
    "patients", "appointments", "transactions", "transactionPayments", "treatmentHistory", "patientMedia",
    "treatmentPlans", "stockItems", "stockMovements", "stockOffers", "stockRecipes", "clinicDoctors",
    "clinicConfig", "clinicChairs", "communicationLog", "consentRecords", "consentHistory", "treatments",
    "staffRecords", "surveys", "surveyResponses", "recalls", "reminderSettings", "reminderDeliveries", "trashItems"
  ]);

  function utf8Length(value) {
    if (typeof TextEncoder === "function") return new TextEncoder().encode(value).byteLength;
    let length = 0;
    for (const character of value) {
      const point = character.codePointAt(0);
      length += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
    }
    return length;
  }
  function boundedData(value, maximumBytes, maximumDepth = MAX_PAYLOAD_DEPTH, maximumNodes = MAX_PAYLOAD_NODES) {
    let serialized;
    try { serialized = JSON.stringify(value); } catch { return false; }
    if (typeof serialized !== "string" || utf8Length(serialized) > maximumBytes) return false;
    const stack = [[value, 0]];
    const seen = new WeakSet();
    let nodes = 0;
    while (stack.length) {
      const [current, depth] = stack.pop();
      if (!current || typeof current !== "object") continue;
      if (depth > maximumDepth || seen.has(current)) return false;
      seen.add(current);
      const keys = Object.keys(current);
      nodes += keys.length;
      if (nodes > maximumNodes || keys.some((key) => RESERVED_KEYS.has(key))) return false;
      for (const key of keys) stack.push([current[key], depth + 1]);
    }
    return true;
  }

  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }

  function digest(value) {
    const input = typeof value === "string" ? value : stable(value);
    let left = 0x811c9dc5;
    let right = 0x9e3779b9;
    for (let index = 0; index < input.length; index += 1) {
      const code = input.charCodeAt(index);
      left = Math.imul(left ^ code, 0x01000193) >>> 0;
      right = Math.imul(right ^ code, 0x85ebca6b) >>> 0;
    }
    return `${left.toString(16).padStart(8, "0")}${right.toString(16).padStart(8, "0")}`;
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function dominates(left, right) {
    let greater = false;
    for (const device of new Set([...Object.keys(left || {}), ...Object.keys(right || {})])) {
      const a = Number(left?.[device] || 0); const b = Number(right?.[device] || 0);
      if (a < b) return false;
      if (a > b) greater = true;
    }
    return greater;
  }
  function operationOrder(left, right) {
    return Number(left.timestamp) - Number(right.timestamp) || String(left.deviceId).localeCompare(String(right.deviceId)) || Number(left.seq) - Number(right.seq) || String(left.opId).localeCompare(String(right.opId));
  }
  function recordMap(document) {
    const records = new Map();
    for (const [collection, items] of Object.entries(document || {})) {
      if (!COLLECTIONS.has(collection) || !Array.isArray(items)) continue;
      for (const item of items) {
        if (!item || typeof item !== "object" || item.id === undefined || item.id === null) continue;
        const entityId = String(item.id);
        if (entityId.length < 1 || entityId.length > 160 || RESERVED_KEYS.has(entityId) || !boundedData(item, MAX_OPERATION_BYTES)) continue;
        records.set(`${collection}:${entityId}`, { collection, entityId, payload: clone(item) });
      }
    }
    return records;
  }

  class MeshEngine {
    constructor({ clinicId, deviceId, state }) {
      if (!/^[A-Za-z0-9_-]{8,128}$/.test(String(clinicId || ""))) throw new Error("Klinik ağ kimliği geçersiz.");
      if (!/^[A-Za-z0-9._:-]{8,128}$/.test(String(deviceId || "")) || RESERVED_KEYS.has(String(deviceId))) throw new Error("Cihaz kimliği geçersiz.");
      this.clinicId = String(clinicId);
      this.deviceId = String(deviceId);
      this.operations = new Map();
      this.vector = Object.create(null);
      this.conflicts = [];
      if (state) this.importState(state);
    }

    importState(state) {
      if (!state || state.protocol !== PROTOCOL || state.clinicId !== this.clinicId || !Array.isArray(state.operations)) return;
      this.merge(state);
    }

    validateOperation(operation) {
      if (!operation || operation.clinicId !== this.clinicId || typeof operation.opId !== "string" || typeof operation.deviceId !== "string") return false;
      if (!/^[A-Za-z0-9._:-]{8,128}$/.test(operation.deviceId) || RESERVED_KEYS.has(operation.deviceId) || operation.opId !== `${operation.deviceId}:${operation.seq}`) return false;
      if (!Number.isSafeInteger(operation.seq) || operation.seq < 1 || !Number.isSafeInteger(operation.timestamp) || operation.timestamp < 1) return false;
      if (!COLLECTIONS.has(operation.collection) || typeof operation.entityId !== "string" || operation.entityId.length < 1 || operation.entityId.length > 160 || RESERVED_KEYS.has(operation.entityId)) return false;
      if (!['UPSERT', 'DELETE'].includes(operation.action) || !operation.vector || typeof operation.vector !== "object" || Object.keys(operation.vector).length > MAX_DEVICES) return false;
      if (Object.keys(operation.vector).some((device) => RESERVED_KEYS.has(device) || !/^[A-Za-z0-9._:-]{8,128}$/.test(device))) return false;
      if (Number(operation.vector[operation.deviceId]) !== operation.seq || Object.values(operation.vector).some((value) => !Number.isSafeInteger(value) || value < 0)) return false;
      if (operation.action === "UPSERT" && (!operation.payload || typeof operation.payload !== "object" || Array.isArray(operation.payload) || String(operation.payload.id) !== operation.entityId || !boundedData(operation.payload, MAX_OPERATION_BYTES))) return false;
      if (operation.action === "DELETE" && operation.payload !== null) return false;
      if (typeof operation.prevHash !== "string" || (operation.prevHash !== "" && !/^[a-f0-9]{16}$/.test(operation.prevHash)) || !/^[a-f0-9]{16}$/.test(String(operation.hash || ""))) return false;
      if (!boundedData(operation, MAX_OPERATION_BYTES, MAX_PAYLOAD_DEPTH + 2, MAX_PAYLOAD_NODES + MAX_DEVICES)) return false;
      const body = { ...operation }; delete body.hash;
      return operation.hash === digest(body);
    }

    merge(envelope) {
      if (!envelope || envelope.protocol !== PROTOCOL || envelope.clinicId !== this.clinicId || !Array.isArray(envelope.operations) || envelope.operations.length > MAX_OPERATIONS || !boundedData(envelope, MAX_ENVELOPE_BYTES, MAX_PAYLOAD_DEPTH + 4, MAX_OPERATIONS * 40)) throw new Error("Cihaz eşitleme paketi geçersiz.");
      if (envelope.digest !== digest(envelope.operations)) throw new Error("Cihaz eşitleme bütünlük özeti uyuşmuyor.");
      const incomingByDevice = new Map();
      for (const operation of envelope.operations) {
        if (!this.validateOperation(operation)) throw new Error("Cihaz işlem günlüğü bozuk.");
        const existing = this.operations.get(operation.opId);
        if (existing && existing.hash !== operation.hash) throw new Error("Aynı işlem kimliği farklı veri içeriyor.");
        const list = incomingByDevice.get(operation.deviceId) || [];
        list.push(operation); incomingByDevice.set(operation.deviceId, list);
      }
      for (const list of incomingByDevice.values()) {
        list.sort((a, b) => a.seq - b.seq);
        if (list[0].seq !== 1 || list[0].prevHash !== "") throw new Error("Cihaz işlem zincirinin başlangıcı eksik.");
        for (let index = 1; index < list.length; index += 1) {
          if (list[index].seq === list[index - 1].seq && list[index].opId !== list[index - 1].opId) throw new Error("Cihaz sıra numarası çakışıyor.");
          if (list[index].seq !== list[index - 1].seq + 1 || list[index].prevHash !== list[index - 1].hash) throw new Error("Cihaz işlem zinciri doğrulanamadı.");
        }
      }
      const additions = new Set(envelope.operations.filter((operation) => !this.operations.has(operation.opId)).map((operation) => operation.opId));
      if (this.operations.size + additions.size > MAX_OPERATIONS) throw new Error("Cihaz işlem günlüğü güvenli sınırı aştı; arşivleme gerekli.");
      for (const operation of envelope.operations) {
        this.operations.set(operation.opId, clone(operation));
        this.vector[operation.deviceId] = Math.max(Number(this.vector[operation.deviceId] || 0), operation.seq);
      }
      return this.materialize();
    }

    append(collection, entityId, action, payload) {
      const normalizedEntityID = String(entityId);
      if (!COLLECTIONS.has(collection) || normalizedEntityID.length < 1 || normalizedEntityID.length > 160 || RESERVED_KEYS.has(normalizedEntityID) || !["UPSERT", "DELETE"].includes(action)) throw new Error("Eşitleme kaydı güvenli sınırların dışında.");
      if (action === "UPSERT" && (!payload || typeof payload !== "object" || Array.isArray(payload) || String(payload.id) !== normalizedEntityID || !boundedData(payload, MAX_OPERATION_BYTES))) throw new Error("Eşitleme kaydı güvenli sınırların dışında.");
      const seq = Number(this.vector[this.deviceId] || 0) + 1;
      const vector = { ...this.vector, [this.deviceId]: seq };
      const previous = [...this.operations.values()].filter((item) => item.deviceId === this.deviceId).sort((a, b) => b.seq - a.seq)[0];
      const body = { protocol: PROTOCOL, clinicId: this.clinicId, opId: `${this.deviceId}:${seq}`, deviceId: this.deviceId, seq, collection, entityId: normalizedEntityID, action, payload: action === "UPSERT" ? clone(payload) : null, vector, timestamp: Date.now(), prevHash: previous?.hash || "" };
      const operation = { ...body, hash: digest(body) };
      this.operations.set(operation.opId, operation);
      this.vector = { ...vector };
    }

    capture(document) {
      const current = recordMap(this.materialize().document);
      const next = recordMap(document);
      const keys = [...new Set([...current.keys(), ...next.keys()])].sort();
      let changes = 0;
      for (const key of keys) {
        const before = current.get(key); const after = next.get(key);
        if (!after && before) { this.append(before.collection, before.entityId, "DELETE", null); changes += 1; continue; }
        if (after && (!before || stable(before.payload) !== stable(after.payload))) { this.append(after.collection, after.entityId, "UPSERT", after.payload); changes += 1; }
      }
      return changes;
    }

    resolveConflict(key, operationId) {
      const conflict = this.materialize().conflicts.find((item) => item.key === key);
      const variant = conflict?.variants.find((item) => item.operationId === operationId);
      if (!conflict || !variant) throw new Error("Çakışma seçimi bulunamadı.");
      const source = this.operations.get(operationId);
      if (!source) throw new Error("Çakışma işlemi bulunamadı.");
      this.append(source.collection, source.entityId, source.action, source.payload);
      return this.materialize();
    }

    materialize() {
      const grouped = new Map();
      for (const operation of this.operations.values()) {
        const key = `${operation.collection}:${operation.entityId}`;
        const list = grouped.get(key) || []; list.push(operation); grouped.set(key, list);
      }
      const document = Object.create(null);
      const conflicts = [];
      for (const [key, operations] of grouped) {
        const maxima = operations.filter((candidate) => !operations.some((other) => other.opId !== candidate.opId && dominates(other.vector, candidate.vector)));
        const live = maxima.filter((item) => item.action === "UPSERT").sort(operationOrder);
        const deletes = maxima.filter((item) => item.action === "DELETE");
        let winner = null;
        if (live.length) winner = live[live.length - 1];
        else if (deletes.length) winner = deletes.sort(operationOrder).at(-1);
        if (!winner) continue;
        if (maxima.length > 1) conflicts.push({ key, chosenOperationId: winner.opId, variants: maxima.sort(operationOrder).map((item) => ({ operationId: item.opId, deviceId: item.deviceId, action: item.action, timestamp: item.timestamp, payload: clone(item.payload) })) });
        if (winner.action === "DELETE") continue;
        (document[winner.collection] ||= []).push(clone(winner.payload));
      }
      for (const items of Object.values(document)) items.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
      this.conflicts = conflicts;
      return { document, conflicts };
    }

    export() {
      const operations = [...this.operations.values()].sort((a, b) => String(a.deviceId).localeCompare(String(b.deviceId)) || a.seq - b.seq);
      return { protocol: PROTOCOL, clinicId: this.clinicId, vector: { ...this.vector }, operations, digest: digest(operations) };
    }

    state() { return this.export(); }
  }

  window.ClinicNovaMeshEngine = Object.freeze({ MeshEngine, stable, digest, dominates, protocol: PROTOCOL });
})();
