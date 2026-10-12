"use strict";
const { randomUUID } = require("node:crypto");
const { fields, reject } = require("../http/errors");
const { loginRequired } = require("../auth/sessions");
const { visible } = require("../catalog/catalog");
const { read, write, requirePermission, can } = require("./state");
function invalid(path, message) {
  reject(422, "INVALID_INPUT", message, { fieldErrors: [{ path, message }] });
}
function formFields(value, s) {
  if (!Array.isArray(value) || value.length > 32)
    invalid("/fields", "最多32个字段。");
  const ids = new Set();
  for (const [i, f] of value.entries()) {
    fields(f, [
      "id",
      "type",
      "label",
      "help",
      "required",
      "min",
      "max",
      "options",
      "disabled",
    ]);
    if (
      typeof f.id !== "string" ||
      !/^f?[a-zA-Z0-9_-]{1,64}$/.test(f.id) ||
      ["__proto__", "constructor", "prototype"].includes(f.id) ||
      ids.has(f.id)
    )
      invalid("/fields/" + i + "/id", "字段标识无效或重复。");
    ids.add(f.id);
    if (
      ![
        "text",
        "textarea",
        "number",
        "select",
        "multiselect",
        "checkbox",
      ].includes(f.type) ||
      typeof f.label !== "string" ||
      !f.label.trim() ||
      f.label.length > 100 ||
      typeof f.required !== "boolean" ||
      (f.help != null && (typeof f.help !== "string" || f.help.length > 500)) ||
      (f.disabled != null && typeof f.disabled !== "boolean")
    )
      invalid("/fields/" + i, "字段类型、标签或参数无效。");
    const old = s.publishedForms
      .flatMap((x) => x.fields)
      .find((x) => x.id === f.id);
    if (old && old.type !== f.type)
      invalid(
        "/fields/" + i + "/type",
        "改变类型请新建字段，旧答案仍引用原字段。",
      );
    for (const k of ["min", "max"])
      if (
        f[k] != null &&
        (!Number.isFinite(f[k]) ||
          (f.type !== "number" &&
            (!Number.isInteger(f[k]) || f[k] < 0 || f[k] > 2000)))
      )
        invalid("/fields/" + i + "/" + k, "范围无效。");
    if (f.min != null && f.max != null && f.min > f.max)
      invalid("/fields/" + i, "最小值不能大于最大值。");
    if (
      ["select", "multiselect"].includes(f.type) &&
      (!Array.isArray(f.options) ||
        !f.options.length ||
        f.options.length > 50 ||
        f.options.some(
          (x) => typeof x !== "string" || !x.trim() || x.length > 100,
        ) ||
        new Set(f.options).size !== f.options.length)
    )
      invalid("/fields/" + i + "/options", "填写不重复的选项。");
  }
  return structuredClone(value);
}
function answers(schema, value) {
  fields(
    value,
    schema.fields.filter((f) => !f.disabled).map((f) => f.id),
  );
  const result = {};
  for (const f of schema.fields.filter((f) => !f.disabled)) {
    const v = value[f.id],
      empty =
        v === undefined ||
        v === null ||
        v === "" ||
        (Array.isArray(v) && !v.length) ||
        (f.type === "checkbox" && v === false);
    if (empty) {
      if (f.required) invalid("/answers/" + f.id, "请填写" + f.label);
      continue;
    }
    if (["text", "textarea"].includes(f.type)) {
      if (
        typeof v !== "string" ||
        !v.trim() ||
        v.length < (f.min ?? 0) ||
        v.length > (f.max ?? 2000)
      )
        invalid("/answers/" + f.id, "文本长度无效。");
    }
    if (
      f.type === "number" &&
      (!Number.isFinite(v) ||
        (f.min != null && v < f.min) ||
        (f.max != null && v > f.max))
    )
      invalid("/answers/" + f.id, "数字超出范围。");
    if (
      (f.type === "select" && !f.options.includes(v)) ||
      (f.type === "multiselect" &&
        (!Array.isArray(v) ||
          new Set(v).size !== v.length ||
          v.some((x) => !f.options.includes(x)))) ||
      (f.type === "checkbox" && typeof v !== "boolean")
    )
      invalid("/answers/" + f.id, "字段值无效。");
    result[f.id] = v;
  }
  return result;
}
function mountRegistration(api, { db, send }) {
  const b = "/tournaments/:tid",
    access = (req) => {
      if (req.method !== "GET") loginRequired(req);
      return visible(db, req, req.params.tid);
    };
  api.get(b + "/registration-form", (req, res) => {
    access(req);
    const s = read(db, req.params.tid),
      edit = can(db, req.params.tid, req.user?.id, "registrationSchema.edit");
    send(req, res, {
      version: s.version,
      open: s.registrationOpen,
      locked: s.rosterLocked,
      form: edit ? s.form : (s.publishedForms.at(-1) ?? null),
      publishedVersion: s.publishedForms.at(-1)?.version ?? 0,
    });
  });
  api.put(b + "/registration-form", (req, res) => {
    access(req);
    fields(req.body, ["expectedVersion", "fields"]);
    send(
      req,
      res,
      write(db, req, "registrationSchema.edit", (s) => {
        if (s.rosterLocked) reject(409, "ROSTER_LOCKED", "名单已锁定。");
        s.form = {
          fields: formFields(req.body.fields, s),
          version: s.form.version,
        };
      }),
    );
  });
  api.post(b + "/registration-form/publish", (req, res) => {
    access(req);
    fields(req.body, ["expectedVersion"]);
    send(
      req,
      res,
      write(db, req, "registrationSchema.edit", (s) => {
        if (s.rosterLocked) reject(409, "ROSTER_LOCKED", "名单已锁定。");
        const f = {
          version: s.publishedForms.length + 1,
          fields: formFields(s.form.fields, s),
        };
        s.publishedForms.push(f);
        s.form = structuredClone(f);
        s.registrationOpen = true;
      }),
    );
  });
  api.get(b + "/my-registration", (req, res) => {
    const uid = loginRequired(req).id,
      s = read(db, req.params.tid),
      r = s.registrations.find((r) => r.userId === uid);
    if (!r) access(req);
    send(req, res, {
      version: s.version,
      registration: r ?? null,
      schema: r
        ? s.publishedForms.find((f) => f.version === r.schemaVersion)
        : null,
    });
  });
  api.get(b + "/registrations", (req, res) => {
    access(req);
    requirePermission(db, req, req.params.tid, "registration.review");
    const s = read(db, req.params.tid);
    send(req, res, {
      version: s.version,
      locked: s.rosterLocked,
      open: s.registrationOpen,
      items: s.registrations,
      schemas: s.publishedForms,
    });
  });
  api.post(b + "/registrations", (req, res) => {
    access(req);
    fields(req.body, ["schemaVersion", "answers"]);
    send(
      req,
      res,
      write(
        db,
        req,
        null,
        (s, uid) => {
          if (!s.registrationOpen || s.rosterLocked)
            reject(409, "REGISTRATION_CLOSED", "报名尚未开放或名单已锁定。");
          const schema = s.publishedForms.at(-1);
          if (!schema || req.body.schemaVersion !== schema.version)
            reject(409, "SCHEMA_CHANGED", "报名表已改版，请重新读取。");
          const old = s.registrations.find((r) => r.userId === uid);
          if (old?.status === "approved")
            reject(409, "REGISTRATION_APPROVED", "报名已审批，不能修改。");
          const r = {
            id: old?.id ?? randomUUID(),
            userId: uid,
            name: req.user.displayName,
            schemaVersion: schema.version,
            answers: answers(schema, req.body.answers),
            status: "submitted",
            seed: null,
            sourceId: null,
          };
          if (old) s.registrations[s.registrations.indexOf(old)] = r;
          else s.registrations.push(r);
          return r;
        },
        { version: false },
      ),
      201,
    );
  });
  api.post(b + "/registrations/:rid/approve", (req, res) => {
    access(req);
    fields(req.body, [
      "expectedVersion",
      "seed",
      "sourceId",
      "entryRef",
      "approved",
    ]);
    send(
      req,
      res,
      write(db, req, "registration.review", (s) => {
        if (s.rosterLocked) reject(409, "ROSTER_LOCKED", "名单已锁定。");
        const r = s.registrations.find((r) => r.id === req.params.rid);
        if (!r) reject(404, "NOT_FOUND", "未找到报名。");
        if (req.body.approved === false) {
          r.status = "rejected";
          r.seed = null;
          r.sourceId = null;
          delete r.entryRef;
          return;
        }
        if (
          !Number.isInteger(req.body.seed) ||
          req.body.seed < 1 ||
          req.body.seed > 64 ||
          s.registrations.some(
            (x) =>
              x.id !== r.id &&
              x.status === "approved" &&
              x.seed === req.body.seed,
          )
        )
          invalid("/seed", "种子应为1–64且不能重复。");
        if (
          req.body.sourceId != null &&
          (typeof req.body.sourceId !== "string" ||
            req.body.sourceId.length > 100)
        )
          invalid("/sourceId", "小组/阶段标识无效。");
        let entryRef;
        if (req.body.entryRef != null) {
          if (req.body.sourceId != null)
            invalid("/entryRef", "请用具名入口或旧sourceId中的一种。");
          const {
            configurationStructure,
            validateEntryRef,
            entryKey,
          } = require("./entry-ref");
          const structure = configurationStructure(
            db,
            req.params.tid,
            req.body.entryRef.configurationId,
          );
          entryRef = validateEntryRef(
            structure,
            req.body.entryRef.configurationId,
            req.body.entryRef,
            req.params.tid,
          );
          if (
            s.registrations.some(
              (x) =>
                x.id !== r.id &&
                x.status === "approved" &&
                x.entryRef &&
                entryKey(x.entryRef) === entryKey(entryRef),
            )
          )
            reject(422, "ENTRY_POSITION_CONFLICT", "该具名入口席位已分配。");
          const { entryChannel } = require("./entry-ref");
          if (
            s.registrations.some(
              (x) =>
                x.id !== r.id &&
                x.status === "approved" &&
                x.entryRef &&
                x.entryRef.configurationId === entryRef.configurationId &&
                x.entryRef.groupId === entryRef.groupId &&
                entryChannel(x.entryRef) === entryChannel(entryRef) &&
                x.entryRef.positionKind !== entryRef.positionKind,
            )
          )
            reject(422, "ENTRY_KIND_CONFLICT", "同一入口不能混用seed/slot。");
        }
        r.status = "approved";
        r.seed = req.body.seed;
        r.sourceId = entryRef?.groupId ?? req.body.sourceId ?? null;
        if (entryRef) r.entryRef = entryRef;
        else delete r.entryRef;
      }),
    );
  });
  api.post(b + "/roster/lock", (req, res) => {
    access(req);
    fields(req.body, ["expectedVersion", "configurationId"]);
    send(
      req,
      res,
      write(db, req, "registration.review", (s) => {
        if (s.rosterLocked) reject(409, "ROSTER_LOCKED", "名单已经锁定。");
        const roster = s.registrations.filter((r) => r.status === "approved");
        if (roster.length < 2 || roster.length > 64)
          invalid("/registrations", "需要2–64名已审批参赛者。");
        const referenceIds = [
          ...new Set(
            roster
              .filter((r) => r.entryRef)
              .map((r) => r.entryRef.configurationId),
          ),
        ];
        if (referenceIds.length > 1)
          reject(422, "ENTRY_INVALID", "名单入口必须绑定同一个配置。");
        const cid = req.body.configurationId ?? referenceIds[0];
        if (cid) {
          const row = db
            .prepare(
              "SELECT data FROM structure_aggregates WHERE tournamentId=?",
            )
            .get(req.params.tid);
          const c = (row ? JSON.parse(row.data).configurations : []).find(
            ([id]) => id === cid,
          )?.[1];
          if (!c?.snapshot)
            reject(
              409,
              "CONFIG_NOT_FROZEN",
              "锁定具名入口前请先冻结所选配置。",
            );
          if (c.snapshot.structure.structureVersion !== "structure-v2")
            reject(422, "ENTRY_INVALID", "具名入口仅用于v2配置。");
          const normalized = require("./entry-ref").rosterEntries(
            c.snapshot.structure,
            cid,
            roster,
            req.params.tid,
          );
          require("./runtime-v2").assertInventory({
            structure: c.snapshot.structure,
            plan: c.snapshot.plan,
            roster: normalized,
          });
          for (const r of roster) {
            r.entryRef = normalized.find((e) => e.entrantId === r.id).entryRef;
            r.sourceId = r.entryRef.groupId;
          }
          s.rosterConfigurationId = cid;
        }
        s.rosterLocked = true;
        s.registrationOpen = false;
      }),
    );
  });
}
module.exports = { mountRegistration, formFields, answers };
