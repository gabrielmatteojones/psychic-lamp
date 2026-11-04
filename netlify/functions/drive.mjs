// Drive: API protetta da Netlify Identity. Netlify verifica il JWT e popola
// context.clientContext.user solo se la richiesta ha un token valido.
import { getStore, connectLambda } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

const MAX_BODY = 200000;
const ID_RE = /^[a-f0-9-]{36}$/;

const reply = (status, data) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(data),
});

export const handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) return reply(401, { error: "Accesso richiesto." });

  connectLambda(event);
  const store = getStore({ name: "drive", consistency: "strong" });

  const roles = (user.app_metadata && user.app_metadata.roles) || [];
  const isAdmin = roles.includes("admin");
  const uid = user.sub || user.email;
  const name = (user.user_metadata && user.user_metadata.full_name) || user.email;
  const canEdit = (doc) => isAdmin || doc.author === uid;
  const id = event.queryStringParameters && event.queryStringParameters.id;

  try {
    if (event.httpMethod === "GET" && !id) {
      const { blobs } = await store.list({ prefix: "docs/" });
      const docs = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
      const list = docs.filter(Boolean).map((d) => ({
        id: d.id, title: d.title, authorName: d.authorName,
        created: d.created, updated: d.updated, mine: canEdit(d),
      }));
      list.sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
      return reply(200, list);
    }

    if (event.httpMethod === "GET") {
      if (!ID_RE.test(id)) return reply(400, { error: "ID non valido." });
      const doc = await store.get("docs/" + id, { type: "json" });
      if (!doc) return reply(404, { error: "Documento non trovato." });
      return reply(200, { ...doc, mine: canEdit(doc) });
    }

    if (event.httpMethod === "POST") {
      const data = JSON.parse(event.body || "{}");
      const title = String(data.title || "").trim().slice(0, 120) || "Senza titolo";
      const body = String(data.body || "");
      if (body.length > MAX_BODY) return reply(413, { error: "Documento troppo lungo." });
      const now = new Date().toISOString();
      let doc;
      if (data.id) {
        if (!ID_RE.test(data.id)) return reply(400, { error: "ID non valido." });
        const old = await store.get("docs/" + data.id, { type: "json" });
        if (!old) return reply(404, { error: "Documento non trovato." });
        if (!canEdit(old)) return reply(403, { error: "Puoi modificare solo i tuoi documenti." });
        doc = { ...old, title, body, updated: now };
      } else {
        doc = { id: randomUUID(), title, body, author: uid, authorName: name, created: now, updated: now };
      }
      await store.setJSON("docs/" + doc.id, doc);
      return reply(200, { id: doc.id, title: doc.title, updated: doc.updated });
    }

    if (event.httpMethod === "DELETE") {
      if (!ID_RE.test(id || "")) return reply(400, { error: "ID non valido." });
      const doc = await store.get("docs/" + id, { type: "json" });
      if (!doc) return reply(404, { error: "Documento non trovato." });
      if (!canEdit(doc)) return reply(403, { error: "Puoi eliminare solo i tuoi documenti." });
      await store.delete("docs/" + id);
      return reply(200, { ok: true });
    }

    return reply(405, { error: "Metodo non consentito." });
  } catch (e) {
    console.error(e);
    return reply(500, { error: "Errore del server." });
  }
};
