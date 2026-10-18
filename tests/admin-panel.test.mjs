import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPanelMatches } from "../admin/panel-data.js";
import {
  filterMatches,
  matchCounts,
  validateScore,
  escapeHTML,
  peruDate,
} from "../admin/panel-model.js";
import { createMesaHandler } from "../supabase/functions/admin-mesa/handler.mjs";
const admin = "00000000-0000-4000-8000-000000000001",
  mesa = "00000000-0000-4000-8000-000000000002",
  attempt = "00000000-0000-4000-8000-000000000003";
function matchClient(
  groups,
  knockout,
  groupError = null,
  knockoutError = null,
) {
  return {
    from(table) {
      const q = {
        select() {
          return q;
        },
        order() {
          return q;
        },
        range(start, end) {
          return Promise.resolve({
            data: (table === "partidos" ? groups : knockout).slice(
              start,
              end + 1,
            ),
            error: table === "partidos" ? groupError : knockoutError,
          });
        },
      };
      return q;
    },
  };
}
test("Match listing includes knockout games and reads beyond the first 500 rows", async () => {
  const groups = Array.from({ length: 501 }, (_, i) => ({ id: "group-" + i }));
  const result = await loadPanelMatches(
    matchClient(groups, [{ id: "sf1", fase: "SF1" }]),
  );
  assert.equal(result.matches.length, 502);
  assert.equal(result.matches.at(-1).origen, "eliminatorias");
  assert.equal(result.knockoutWarning, "");
});
test("An unavailable knockout table does not hide group games, while group failures stay explicit", async () => {
  const result = await loadPanelMatches(
    matchClient([{ id: "group" }], [], null, { code: "PGRST205" }),
  );
  assert.equal(result.matches.length, 1);
  assert.match(result.knockoutWarning, /sin activar/);
  await assert.rejects(
    loadPanelMatches(matchClient([], [], new Error("Groups unavailable"))),
    /Groups unavailable/,
  );
});
const rows = [
  {
    categoria: "2014",
    estado: "EN_REVISION",
    reclamo: "Documento por revisar",
    equipo_local: { nombre: "Atlético Junior" },
  },
  {
    categoria: "2015",
    estado: "OFICIAL",
    reclamo: "",
    equipo_local: { nombre: "Estudiantes" },
  },
  {
    categoria: "2014",
    estado: "OFICIAL",
    reclamo: "Reclamo conservado",
    equipo_local: { nombre: "U Cajamarca" },
  },
];
test("Category, status, accent-insensitive search and claims combine without losing official claims", () => {
  assert.equal(
    filterMatches(rows, {
      category: "2014",
      status: "EN_REVISION",
      search: "atletico",
      claims: true,
    }).length,
    1,
  );
  assert.equal(filterMatches(rows, { claims: true }).length, 2);
  assert.deepEqual(matchCounts(rows), {
    review: 1,
    claims: 2,
    official: 2,
    live: 0,
  });
});
test("Scores reject absent, negative, fractional and oversized results; zero remains valid", () => {
  assert.equal(validateScore("0", "0"), true);
  for (const n of ["", null, -1, 1.5, 100, "not-a-number"])
    assert.equal(validateScore(n, 1), false);
});
test("Unsafe claims are escaped and invalid dates do not break the acta", () => {
  assert.equal(
    escapeHTML('<img onerror="x">'),
    "&lt;img onerror=&quot;x&quot;&gt;",
  );
  assert.equal(peruDate("wrong"), "Por programar");
});
function harness({
  authorized = true,
  authError = false,
  rateLimited = false,
  updateError = false,
} = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    const p = new URL(url).pathname,
      c = {
        path: p,
        method: options.method,
        body: options.body ? JSON.parse(options.body) : null,
      };
    calls.push(c);
    let data,
      status = 200;
    if (p === "/auth/v1/user") {
      data = { id: admin };
      if (authError) status = 401;
    } else if (p === "/rest/v1/panel_admins")
      data = new URL(url).searchParams.has("user_id")
        ? authorized
          ? [{ user_id: admin }]
          : []
        : [{ user_id: admin }];
    else if (p === "/rest/v1/mesa_accesos")
      data = [
        { user_id: mesa, nombre: "Mesa principal" },
        { user_id: admin, nombre: "No debe aparecer" },
      ];
    else if (p === "/rest/v1/rpc/reservar_cambio_mesa") {
      data = attempt;
      if (rateLimited) status = 400;
    } else if (p === "/rest/v1/admin_accesos_historial") data = [];
    else if (p === "/auth/v1/admin/users/" + mesa) {
      data = { id: mesa, email: "mesa@example.test" };
      if (options.method === "PUT" && updateError) status = 500;
    } else throw new Error("Unexpected API path " + p);
    return new Response(JSON.stringify(data), { status });
  };
  return {
    calls,
    handler: createMesaHandler({
      url: "https://backend.example.test",
      key: "server-test-key",
      fetcher,
    }),
  };
}
const request = (body, token = true, origin = "http://localhost:8090") =>
  new Request("https://edge.example.test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(token ? { Authorization: "Bearer test-session" } : {}),
    },
    body: JSON.stringify(body),
  });
test("Anonymous and unapproved accounts never reach the Auth Admin API", async () => {
  for (const options of [{ authorized: false }, { authError: true }]) {
    const h = harness(options);
    assert.equal((await h.handler(request({ action: "list" }))).status, 403);
    assert.ok(!h.calls.some((c) => c.path.startsWith("/auth/v1/admin/")));
  }
  const h = harness();
  assert.equal(
    (await h.handler(request({ action: "list" }, false))).status,
    401,
  );
  assert.equal(h.calls.length, 0);
});
test("Origin restriction and invalid operations fail before privileged queries", async () => {
  const h = harness();
  assert.equal(
    (
      await h.handler(
        request({ action: "list" }, true, "https://unrelated.example.test"),
      )
    ).status,
    403,
  );
  assert.equal((await h.handler(request({ action: "delete" }))).status, 400);
  assert.equal(h.calls.length, 0);
});
test("List exposes registered mesa accounts only and does not return secrets or admin accounts", async () => {
  const h = harness(),
    result = await (await h.handler(request({ action: "list" }))).json();
  assert.deepEqual(
    result.users.map((u) => u.id),
    [mesa],
  );
  assert.ok(!JSON.stringify(result).includes("server-test-key"));
});
test("Password cannot target the administrator or an unregistered account; short values are rejected", async () => {
  for (const [id, password] of [
    [admin, "fixture-only-long-password"],
    [attempt, "fixture-only-long-password"],
    [mesa, "short"],
  ]) {
    const h = harness();
    const res = await h.handler(
      request({ action: "password", user_id: id, password }),
    );
    assert.ok([400, 403].includes(res.status));
    assert.ok(!h.calls.some((c) => c.method === "PUT"));
  }
});
test("A password update records a reservation and outcome without putting the password in audit rows", async () => {
  const h = harness(),
    res = await h.handler(
      request({
        action: "password",
        user_id: mesa,
        password: "fixture-only-long-password",
      }),
    );
  assert.equal(res.status, 200);
  assert.equal(
    h.calls.find((c) => c.method === "PUT").path,
    "/auth/v1/admin/users/" + mesa,
  );
  const log = h.calls.filter((c) => c.path.startsWith("/rest/"));
  assert.ok(!JSON.stringify(log).includes("fixture-only-long-password"));
  assert.equal(log.at(-1).body.estado, "EXITO");
});
test("Rate limiting prevents a credential write and upstream failures are recorded without leaking details", async () => {
  const blocked = harness({ rateLimited: true });
  assert.equal(
    (
      await blocked.handler(
        request({
          action: "password",
          user_id: mesa,
          password: "fixture-only-long-password",
        }),
      )
    ).status,
    429,
  );
  assert.ok(!blocked.calls.some((c) => c.method === "PUT"));
  const failed = harness({ updateError: true }),
    res = await failed.handler(
      request({
        action: "password",
        user_id: mesa,
        password: "fixture-only-long-password",
      }),
    );
  assert.equal(res.status, 502);
  assert.equal(failed.calls.at(-1).body.estado, "ERROR");
  assert.ok(!(await res.text()).includes("fixture-only-long-password"));
});
