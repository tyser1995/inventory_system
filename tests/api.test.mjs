// End-to-end API tests. Run via `npm test` (isolated server + temp data).
// Tests are ordered: later suites build on accounts/data created earlier.
import assert from "node:assert/strict";
import { describe, it, before } from "node:test";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const rand = () => Math.random().toString(36).slice(2, 10);
const strongPw = () => `Pw-${rand()}-${rand()}`;

/** Minimal API client that keeps the session cookie like a browser would. */
class Client {
  constructor(name) {
    this.name = name;
    this.cookie = "";
  }
  async req(method, path, body, { raw = false, headers = {} } = {}) {
    const res = await fetch(BASE + path, {
      method,
      redirect: "manual",
      headers: {
        ...(body !== undefined && !raw ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const [k, ...v] = pair.split("=");
      if (k.trim() !== "sv_session") continue;
      const value = v.join("=");
      this.cookie = !value || /expires=thu, 01 jan 1970/i.test(c) || /max-age=0/i.test(c) ? "" : `sv_session=${value}`;
    }
    const text = await res.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON body */
    }
    return { status: res.status, data, headers: res.headers, text };
  }
  get(p, o) { return this.req("GET", p, undefined, o); }
  post(p, b = {}, o) { return this.req("POST", p, b, o); }
  put(p, b = {}) { return this.req("PUT", p, b); }
  patch(p, b = {}) { return this.req("PATCH", p, b); }
  del(p) { return this.req("DELETE", p); }
  async login(email, password) {
    const r = await this.post("/api/auth/login", { email, password });
    assert.equal(r.status, 200, `${this.name} login failed: ${JSON.stringify(r.data)}`);
    return r;
  }
}

const anon = new Client("anon");
const sa = new Client("superadmin");
const admin = new Client("admin");
const manager = new Client("manager");
const staff = new Client("staff");
const accounts = {
  sa: { email: `owner-${rand()}@test.local`, password: strongPw() },
  admin: { email: `admin-${rand()}@test.local`, password: strongPw() },
  manager: { email: `manager-${rand()}@test.local`, password: strongPw() },
  staff: { email: `staff-${rand()}@test.local`, password: strongPw() },
};
const ids = {};

/* ─────────────────────────────────────────────────────────────── */

describe("1. Public access & route protection", () => {
  it("serves the login page and redirects protected pages", async () => {
    assert.equal((await anon.get("/login")).status, 200);
    const home = await anon.get("/");
    assert.equal(home.status, 307);
    assert.match(home.headers.get("location"), /\/login$/);
    const products = await anon.get("/products?x=1");
    assert.equal(products.status, 307);
    assert.match(products.headers.get("location"), /\/login\?next=%2Fproducts%3Fx%3D1$/);
  });

  it("reports first-run setup is needed", async () => {
    const r = await anon.get("/api/auth/status");
    assert.deepEqual(r.data, { needsSetup: true, signedIn: false });
  });

  it("rejects every protected API without a session (401)", async () => {
    const protectedRoutes = [
      ["GET", "/api/products"], ["POST", "/api/products"], ["GET", "/api/stats"], ["GET", "/api/movements"],
      ["GET", "/api/categories"], ["GET", "/api/suppliers"], ["GET", "/api/users"], ["GET", "/api/roles"],
      ["GET", "/api/backups"], ["GET", "/api/settings/database"], ["GET", "/api/settings/backup"], ["POST", "/api/reset"],
      ["PUT", "/api/branding"], ["GET", "/api/logs/audit"], ["GET", "/api/logs/errors"], ["GET", "/api/alerts"],
      ["GET", "/api/demo"], ["GET", "/api/settings/alerts"], ["GET", "/api/auth/me"], ["POST", "/api/logs/track"],
    ];
    for (const [m, p] of protectedRoutes) {
      const r = await anon.req(m, p, m === "GET" ? undefined : {});
      assert.equal(r.status, 401, `${m} ${p} should be 401, got ${r.status}`);
    }
  });

  it("exposes branding and a hardened logo publicly", async () => {
    const b = await anon.get("/api/branding");
    assert.equal(b.status, 200);
    assert.equal(typeof b.data.appName, "string");
    const logo = await anon.get("/api/branding/logo");
    assert.equal(logo.status, 200);
    assert.match(logo.headers.get("content-security-policy"), /default-src 'none'/);
    assert.equal(logo.headers.get("x-content-type-options"), "nosniff");
  });
});

describe("2. First-run setup", () => {
  it("validates the Super Admin form", async () => {
    const r = await anon.post("/api/auth/setup", { name: "", email: "bad", password: "short" });
    assert.equal(r.status, 422);
    assert.ok(r.data.fieldErrors.name && r.data.fieldErrors.email && r.data.fieldErrors.password);
  });

  it("creates the Super Admin and signs in", async () => {
    const r = await sa.post("/api/auth/setup", { name: "Owner", ...accounts.sa });
    assert.equal(r.status, 200);
    assert.ok(sa.cookie, "session cookie set");
    const me = await sa.get("/api/auth/me");
    assert.equal(me.data.role.id, "superadmin");
    assert.equal(me.data.isSuperadmin, true);
    assert.equal(me.data.user.passwordHash, undefined, "never expose password hash");
  });

  it("can only run once", async () => {
    const r = await anon.post("/api/auth/setup", { name: "X", email: "x@test.local", password: strongPw() });
    assert.equal(r.status, 403);
    assert.equal((await anon.get("/api/auth/status")).data.needsSetup, false);
  });
});

describe("3. Users & roles", () => {
  it("lists built-in roles", async () => {
    const r = await sa.get("/api/roles");
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.filter((x) => x.system).map((x) => x.id).sort(), ["admin", "staff", "superadmin"]);
    const adminRole = r.data.find((x) => x.id === "admin");
    assert.ok(!adminRole.permissions.includes("settings.database") && !adminRole.permissions.includes("roles.manage"));
    assert.ok(adminRole.permissions.includes("logs.view") && adminRole.permissions.includes("settings.alerts"));
  });

  it("creates a custom Manager role", async () => {
    const r = await sa.post("/api/roles", {
      name: "Manager",
      description: "Store manager",
      permissions: ["dashboard.view", "products.view", "products.create", "products.edit", "movements.view", "stock.record", "categories.view", "suppliers.view"],
    });
    assert.equal(r.status, 200);
    ids.managerRole = r.data.id;
    assert.equal((await sa.post("/api/roles", { name: "manager", permissions: [] })).status, 409, "role names are unique");
    assert.equal((await sa.post("/api/roles", { name: "Bad", permissions: ["nope.perm"] })).status, 422);
  });

  it("creates users for each role", async () => {
    for (const [key, roleId] of [["admin", "admin"], ["manager", ids.managerRole], ["staff", "staff"]]) {
      const r = await sa.post("/api/users", { name: `Test ${key}`, roleId, ...accounts[key] });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.passwordHash, undefined);
      ids[`${key}User`] = r.data.id;
    }
    assert.equal((await sa.post("/api/users", { name: "Dup", roleId: "staff", ...accounts.staff })).status, 409);
    assert.equal((await sa.post("/api/users", { name: "X", roleId: "ghost", email: "g@test.local", password: strongPw() })).status, 400);
    assert.equal((await sa.post("/api/users", { name: "X", roleId: "staff", email: "w@test.local", password: "short" })).status, 422);
  });

  it("lets each user sign in (email is case-insensitive)", async () => {
    await admin.login(accounts.admin.email.toUpperCase(), accounts.admin.password);
    await manager.login(accounts.manager.email, accounts.manager.password);
    await staff.login(accounts.staff.email, accounts.staff.password);
    assert.equal((await staff.get("/api/auth/me")).data.role.id, "staff");
  });
});

describe("4. Authentication rules", () => {
  it("rejects a wrong password without revealing which part is wrong", async () => {
    const wrong = await anon.post("/api/auth/login", { email: accounts.staff.email, password: "wrong-password" });
    const unknown = await anon.post("/api/auth/login", { email: "nobody@test.local", password: "wrong-password" });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.data.error, unknown.data.error);
  });

  it("locks out after 5 failed attempts", async () => {
    const email = `lock-${rand()}@test.local`;
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await anon.post("/api/auth/login", { email, password: "nope-nope" })).status);
    assert.deepEqual(codes, [401, 401, 401, 401, 401, 429]);
  });

  it("rejects a tampered session cookie", async () => {
    const c = new Client("tampered");
    c.cookie = "sv_session=eyJ1aWQiOiJ4IiwidiI6MCwiZXhwIjo5OTk5OTk5OTk5fQ.forged";
    assert.equal((await c.get("/api/auth/me")).status, 401);
  });

  it("validates login input", async () => {
    assert.equal((await anon.post("/api/auth/login", { email: "", password: "" })).status, 422);
    assert.equal((await anon.req("POST", "/api/auth/login", "not json", { raw: true, headers: { "Content-Type": "application/json" } })).status, 400);
  });
});

describe("5. Permission matrix (role × endpoint)", () => {
  const FAKE = "00000000-0000-4000-8000-000000000000";
  // Invalid bodies are used on purpose: an authorized request then fails validation (422/404)
  // instead of changing data, while an unauthorized one must be 403.
  const matrix = [
    ["GET", "/api/stats", undefined, ["sa", "admin", "manager", "staff"]],
    ["GET", "/api/products", undefined, ["sa", "admin", "manager", "staff"]],
    ["POST", "/api/products", {}, ["sa", "admin", "manager"]],
    ["PATCH", `/api/products/${FAKE}`, {}, ["sa", "admin", "manager"]],
    ["DELETE", `/api/products/${FAKE}`, undefined, ["sa", "admin"]],
    ["GET", "/api/movements", undefined, ["sa", "admin", "manager", "staff"]],
    ["POST", "/api/movements", {}, ["sa", "admin", "manager", "staff"]],
    ["POST", "/api/categories", {}, ["sa", "admin"]],
    ["POST", "/api/suppliers", {}, ["sa", "admin"]],
    ["GET", "/api/users", undefined, ["sa", "admin"]],
    ["GET", "/api/roles", undefined, ["sa", "admin"]],
    ["POST", "/api/roles", {}, ["sa"]],
    ["GET", "/api/backups", undefined, ["sa", "admin"]],
    ["GET", "/api/settings/backup", undefined, ["sa", "admin"]],
    ["GET", "/api/settings/database", undefined, ["sa"]],
    ["PUT", "/api/branding", {}, ["sa", "admin"]],
    ["GET", "/api/logs/audit", undefined, ["sa", "admin"]],
    ["GET", "/api/logs/errors", undefined, ["sa", "admin"]],
    ["PATCH", "/api/logs/errors", {}, ["sa", "admin"]],
    ["PUT", "/api/logs/settings", {}, ["sa", "admin"]],
    ["GET", "/api/alerts", undefined, ["sa", "admin", "manager", "staff"]],
    ["PUT", "/api/settings/alerts", {}, ["sa", "admin"]],
    ["POST", "/api/products/min-stock", {}, ["sa", "admin", "manager"]],
    ["PUT", "/api/demo", {}, ["sa", "admin"]],
    ["POST", "/api/demo", {}, ["sa", "admin"]],
  ];
  const clients = { sa, admin, manager, staff };

  for (const [method, path, body, allowed] of matrix) {
    it(`${method} ${path}`, async () => {
      for (const [role, client] of Object.entries(clients)) {
        const r = await client.req(method, path, body);
        if (allowed.includes(role)) assert.notEqual(r.status, 403, `${role} should be allowed (${r.status} ${JSON.stringify(r.data)})`);
        else assert.equal(r.status, 403, `${role} should be denied, got ${r.status}`);
        assert.notEqual(r.status, 500, `${role}: server error ${JSON.stringify(r.data)}`);
      }
    });
  }

  it("only data.reset holders can clear data", async () => {
    assert.equal((await staff.post("/api/reset")).status, 403);
    assert.equal((await manager.post("/api/reset")).status, 403);
  });
});

describe("6. Privilege escalation guards", () => {
  it("admin cannot create or manage Super Admins", async () => {
    const create = await admin.post("/api/users", { name: "Evil", roleId: "superadmin", email: `evil-${rand()}@test.local`, password: strongPw() });
    assert.equal(create.status, 403);
    const me = await sa.get("/api/auth/me");
    assert.equal((await admin.patch(`/api/users/${me.data.user.id}`, { active: false })).status, 403);
    assert.equal((await admin.post(`/api/users/${me.data.user.id}/password`, { password: strongPw() })).status, 403);
    assert.equal((await admin.del(`/api/users/${me.data.user.id}`)).status, 403);
  });

  it("admin can assign roles within their own access", async () => {
    const r = await admin.patch(`/api/users/${ids.staffUser}`, { roleId: ids.managerRole });
    assert.equal(r.status, 200);
    await admin.patch(`/api/users/${ids.staffUser}`, { roleId: "staff" });
  });

  it("nobody can demote, deactivate or delete themselves", async () => {
    const me = (await sa.get("/api/auth/me")).data.user.id;
    assert.equal((await sa.patch(`/api/users/${me}`, { roleId: "staff" })).status, 400);
    assert.equal((await sa.patch(`/api/users/${me}`, { active: false })).status, 400);
    assert.equal((await sa.del(`/api/users/${me}`)).status, 400);
  });

  it("the Super Admin role is immutable and built-in roles can't be deleted", async () => {
    assert.equal((await sa.put("/api/roles/superadmin", { name: "Super Admin", permissions: [] })).status, 403);
    assert.equal((await sa.del("/api/roles/admin")).status, 400);
  });

  it("a role in use can't be deleted", async () => {
    const r = await sa.del(`/api/roles/${ids.managerRole}`);
    assert.equal(r.status, 409);
  });
});

describe("7. Inventory rules", () => {
  it("validates products", async () => {
    const r = await sa.post("/api/products", { sku: "", name: "", costPrice: -1, sellPrice: "x" });
    assert.equal(r.status, 422);
    for (const f of ["sku", "name", "costPrice", "sellPrice"]) assert.ok(r.data.fieldErrors[f], `missing error for ${f}`);
  });

  it("creates a product with opening stock and records who did it", async () => {
    const r = await manager.post("/api/products", { sku: `T-${rand()}`, name: "Test Widget", costPrice: 10, sellPrice: 15, quantity: 20, reorderLevel: 5 });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    ids.product = r.data.id;
    ids.sku = r.data.sku;
    const mv = (await sa.get("/api/movements")).data.find((m) => m.productId === ids.product);
    assert.equal(mv.note, "Opening stock");
    assert.equal(mv.userName, "Test manager");
  });

  it("enforces unique SKUs (case-insensitive), including against demo data", async () => {
    assert.equal((await sa.post("/api/products", { sku: ids.sku.toLowerCase(), name: "Dup", costPrice: 1, sellPrice: 1 })).status, 409);
    const demoDup = await sa.post("/api/products", { sku: "CPU-R9-7950X", name: "Dup", costPrice: 1, sellPrice: 1 });
    assert.equal(demoDup.status, 409);
    assert.match(demoDup.data.error, /demo data/);
  });

  it("records IN / OUT / ADJUST and keeps a correct ledger", async () => {
    const steps = [["IN", 5, 25], ["OUT", 3, 22], ["ADJUST", -2, 20]];
    for (const [type, quantity, expected] of steps) {
      const r = await staff.post("/api/movements", { productId: ids.product, type, quantity });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.balanceAfter, expected);
    }
    assert.equal((await sa.get(`/api/products/${ids.product}`)).data.quantity, 20);
  });

  it("blocks overselling and zero quantities", async () => {
    const r = await staff.post("/api/movements", { productId: ids.product, type: "OUT", quantity: 999 });
    assert.equal(r.status, 409);
    assert.match(r.data.error, /Insufficient stock/);
    assert.equal((await staff.post("/api/movements", { productId: ids.product, type: "IN", quantity: 0 })).status, 422);
    assert.equal((await staff.post("/api/movements", { productId: ids.product, type: "ADJUST", quantity: 0 })).status, 422);
    assert.equal((await staff.post("/api/movements", { productId: "nope", type: "IN", quantity: 1 })).status, 404);
  });

  it("does not allow editing quantity directly", async () => {
    await sa.patch(`/api/products/${ids.product}`, { quantity: 9999, name: "Test Widget Pro" });
    const p = (await sa.get(`/api/products/${ids.product}`)).data;
    assert.equal(p.quantity, 20);
    assert.equal(p.name, "Test Widget Pro");
  });

  it("computes dashboard totals from the active products", async () => {
    const [stats, list] = await Promise.all([sa.get("/api/stats"), sa.get("/api/products")]);
    const value = list.data.reduce((s, p) => s + p.quantity * p.costPrice, 0);
    assert.equal(stats.data.totalProducts, list.data.length);
    assert.equal(Math.round(stats.data.inventoryValue * 100), Math.round(value * 100));
    assert.equal(stats.data.outOfStockCount, list.data.filter((p) => p.quantity <= 0).length);
  });

  it("categories: unique names, and deleting one detaches its products", async () => {
    const c = await sa.post("/api/categories", { name: `Cat ${rand()}` });
    assert.equal(c.status, 200);
    assert.equal((await sa.post("/api/categories", { name: c.data.name.toUpperCase() })).status, 409);
    await sa.patch(`/api/products/${ids.product}`, { categoryId: c.data.id });
    assert.equal((await sa.del(`/api/categories/${c.data.id}`)).status, 204);
    assert.equal((await sa.get(`/api/products/${ids.product}`)).data.categoryId, null);
  });

  it("suppliers: validates email, create/update/delete", async () => {
    assert.equal((await sa.post("/api/suppliers", { name: "S", email: "not-an-email" })).status, 422);
    const s = await sa.post("/api/suppliers", { name: "Test Supplier", email: "s@test.local" });
    assert.equal(s.status, 200);
    assert.equal((await sa.put(`/api/suppliers/${s.data.id}`, { name: "Renamed" })).data.name, "Renamed");
    assert.equal((await sa.del(`/api/suppliers/${s.data.id}`)).status, 204);
  });
});

describe("8. Minimum stock & alerts", () => {
  before(async () => {
    await sa.put("/api/settings/alerts", { enabled: true, notifyRestock: true, defaultMinStock: 5 });
  });

  it("raises low, out-of-stock and restocked alerts as stock crosses the minimum", async () => {
    // Test Widget: qty 20, min 5
    await staff.post("/api/movements", { productId: ids.product, type: "OUT", quantity: 16 }); // 4 → low
    await staff.post("/api/movements", { productId: ids.product, type: "OUT", quantity: 4 }); // 0 → out
    await staff.post("/api/movements", { productId: ids.product, type: "IN", quantity: 10 }); // 10 → restocked
    const { data } = await staff.get("/api/alerts");
    const mine = data.items.filter((a) => a.productId === ids.product).map((a) => [a.kind, a.quantity, a.minLevel]);
    assert.deepEqual(mine.slice(0, 3), [["restocked", 10, 5], ["out-of-stock", 0, 5], ["low-stock", 4, 5]]);
  });

  it("does not repeat an alert while stock stays in the same state", async () => {
    const before = (await sa.get("/api/alerts")).data.items.length;
    await staff.post("/api/movements", { productId: ids.product, type: "OUT", quantity: 1 }); // 9, still in stock
    assert.equal((await sa.get("/api/alerts")).data.items.length, before);
  });

  it("tracks read state per user", async () => {
    const s0 = (await staff.get("/api/alerts")).data.unread;
    assert.ok(s0 > 0);
    assert.equal((await staff.post("/api/alerts/read", {})).status, 200);
    assert.equal((await staff.get("/api/alerts")).data.unread, 0);
    assert.ok((await admin.get("/api/alerts")).data.unread > 0, "other users keep their unread alerts");
  });

  it("raises an alert when a new product is created at or below its minimum", async () => {
    const p = await sa.post("/api/products", { sku: `LOW-${rand()}`, name: "Born Low", costPrice: 1, sellPrice: 2, quantity: 2, reorderLevel: 3 });
    const a = (await sa.get("/api/alerts")).data.items.find((x) => x.productId === p.data.id);
    assert.equal(a?.kind, "low-stock");
    ids.lowProduct = p.data.id;
  });

  it("bulk-sets minimum stock and alerts products that cross it", async () => {
    const before = (await sa.get("/api/alerts")).data.items.length;
    const r = await manager.post("/api/products/min-stock", { scope: "all", minStock: 15 });
    assert.equal(r.status, 200);
    const list = (await sa.get("/api/products")).data;
    assert.equal(r.data.updated, list.length);
    assert.ok(list.every((p) => p.reorderLevel === 15));
    assert.ok((await sa.get("/api/alerts")).data.items.length > before, "products that dropped under 15 alert");
    assert.equal((await manager.post("/api/products/min-stock", { scope: "all", minStock: -1 })).status, 422);
  });

  it("respects the alerts on/off switch and validates settings", async () => {
    await sa.put("/api/settings/alerts", { enabled: false, notifyRestock: true, defaultMinStock: 5 });
    const before = (await sa.get("/api/alerts")).data.items.length;
    await staff.post("/api/movements", { productId: ids.lowProduct, type: "OUT", quantity: 2 }); // → 0
    assert.equal((await sa.get("/api/alerts")).data.items.length, before);
    await sa.put("/api/settings/alerts", { enabled: true, notifyRestock: true, defaultMinStock: 5 });
    assert.equal((await sa.put("/api/settings/alerts", { enabled: true, notifyRestock: true, defaultMinStock: -3 })).status, 422);
    assert.equal((await staff.get("/api/settings/alerts")).data.defaultMinStock, 5, "readable by all signed-in users");
  });
});

describe("9. Demo data (enable / disable / remove / add)", () => {
  it("reports the sample dataset", async () => {
    const r = await sa.get("/api/demo");
    assert.equal(r.data.enabled, true);
    assert.equal(r.data.counts.products, 19);
    assert.ok(r.data.counts.movements > 0);
  });

  it("disabling excludes demo records everywhere but keeps them", async () => {
    const all = (await sa.get("/api/products")).data;
    const demoProduct = all.find((p) => p.demo);
    assert.equal((await admin.put("/api/demo", { enabled: false })).status, 200);
    const visible = (await sa.get("/api/products")).data;
    assert.ok(visible.every((p) => !p.demo));
    assert.equal(visible.length, all.length - 19);
    assert.equal((await sa.get("/api/stats")).data.totalProducts, visible.length);
    assert.ok((await sa.get("/api/movements")).data.every((m) => !m.demo));
    assert.ok((await sa.get("/api/categories")).data.every((c) => !c.demo));
    assert.equal((await sa.get(`/api/products/${demoProduct.id}`)).status, 404);
    assert.equal((await staff.post("/api/movements", { productId: demoProduct.id, type: "IN", quantity: 1 })).status, 404);
    assert.equal((await sa.get("/api/demo")).data.counts.products, 19, "records are kept");
  });

  it("enabling brings them back", async () => {
    await admin.put("/api/demo", { enabled: true });
    assert.equal((await sa.get("/api/products")).data.filter((p) => p.demo).length, 19);
  });

  it("remove deletes only demo records; add loads them again", async () => {
    const realBefore = (await sa.get("/api/products")).data.filter((p) => !p.demo).length;
    const rm = await admin.post("/api/demo", { action: "remove" });
    assert.equal(rm.status, 200);
    const after = (await sa.get("/api/products")).data;
    assert.equal(after.length, realBefore);
    assert.equal((await sa.get(`/api/products/${ids.product}`)).status, 200, "own product kept");
    assert.equal((await sa.get("/api/demo")).data.counts.products, 0);

    const add = await admin.post("/api/demo", { action: "add" });
    assert.equal(add.status, 200);
    assert.equal(add.data.added, 19);
    assert.equal((await admin.post("/api/demo", { action: "add" })).status, 409, "can't load twice");
    assert.equal((await admin.post("/api/demo", { action: "bogus" })).status, 422);
  });
});

describe("10. Branding", () => {
  it("updates the name (shown in the page title) and validates the logo", async () => {
    const r = await sa.put("/api/branding", { appName: "Acme Depot", tagline: "Warehouse", logo: null });
    assert.equal(r.status, 200);
    const html = (await anon.get("/login")).text;
    assert.match(html, /<title>Acme Depot — Warehouse<\/title>/);
    assert.equal((await sa.put("/api/branding", { appName: "", tagline: "", logo: "javascript:alert(1)" })).status, 422);
    const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    assert.equal((await sa.put("/api/branding", { appName: "Acme Depot", tagline: "", logo: png })).status, 200);
    const logo = await anon.get("/api/branding/logo");
    assert.equal(logo.headers.get("content-type"), "image/png");
    await sa.put("/api/branding", { appName: "StockVault", tagline: "Inventory Suite", logo: null });
  });
});

describe("11. Backups", () => {
  it("creates, lists and downloads a manual backup", async () => {
    const r = await sa.post("/api/backups", { label: "Test backup" });
    assert.equal(r.status, 200);
    ids.backup = r.data.id;
    const list = await sa.get("/api/backups");
    assert.ok(list.data.backups.some((b) => b.id === ids.backup && b.kind === "manual"));
    const dl = await sa.get(`/api/backups/${ids.backup}`);
    assert.equal(dl.status, 200);
    assert.match(dl.headers.get("content-disposition"), /attachment/);
    assert.equal(dl.data.format, "stockvault-backup");
    ids.backupFile = dl.text;
  });

  it("imports valid files and rejects invalid ones", async () => {
    const ok = await sa.req("POST", "/api/backups/import?name=t.json", ids.backupFile, { raw: true, headers: { "Content-Type": "application/json" } });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.kind, "imported");
    const bad = await sa.req("POST", "/api/backups/import", '{"hello":1}', { raw: true, headers: { "Content-Type": "application/json" } });
    assert.equal(bad.status, 400);
    const notJson = await sa.req("POST", "/api/backups/import", "nope", { raw: true, headers: { "Content-Type": "text/plain" } });
    assert.equal(notJson.status, 400);
  });

  it("restores data but keeps users, and takes a safety backup first", async () => {
    await sa.post("/api/products", { sku: `AFTER-${rand()}`, name: "Created after backup", costPrice: 1, sellPrice: 1 });
    const r = await sa.post(`/api/backups/${ids.backup}/restore`);
    assert.equal(r.status, 200);
    assert.ok(!(await sa.get("/api/products")).data.some((p) => p.name === "Created after backup"));
    assert.equal((await staff.get("/api/auth/me")).status, 200, "users survive a restore");
    const kinds = (await sa.get("/api/backups")).data.backups.map((b) => b.kind);
    assert.ok(kinds.includes("safety"));
  });

  it("refuses path traversal and unknown ids", async () => {
    assert.equal((await sa.get("/api/backups/..%2F..%2Fconfig")).status, 404);
    assert.equal((await sa.del("/api/backups/2020-01-01T00-00-00-000Z-manual-zzzz")).status, 404);
  });

  it("validates the backup policy", async () => {
    const bad = await sa.put("/api/settings/backup", {
      auto: { enabled: true, intervalMinutes: 1 }, safety: true,
      schedule: { enabled: true, frequency: "monthly", time: "25:00", weekday: 9 }, retention: 0,
    });
    assert.equal(bad.status, 422);
    const good = await sa.put("/api/settings/backup", {
      auto: { enabled: false, intervalMinutes: 60 }, safety: true,
      schedule: { enabled: true, frequency: "daily", time: "02:00", weekday: 0 }, retention: 10,
    });
    assert.equal(good.status, 200);
    assert.ok((await sa.get("/api/backups")).data.nextScheduledAt);
  });

  it("deletes a backup", async () => {
    assert.equal((await sa.del(`/api/backups/${ids.backup}`)).status, 204);
  });
});

describe("12. Database settings", () => {
  it("guards switching providers", async () => {
    assert.equal((await sa.post("/api/settings/database/switch", { provider: "local", mode: "existing" })).status, 400, "already local");
    const r = await sa.post("/api/settings/database/switch", { provider: "supabase", mode: "migrate" });
    assert.equal(r.status, 400);
    assert.match(r.data.error, /Supabase/);
  });

  it("validates and tests Supabase credentials safely", async () => {
    assert.equal((await sa.post("/api/settings/database/test", { url: "not a url" })).status, 422);
    const r = await sa.post("/api/settings/database/test", { url: "https://invalid-project-ref-xyz.supabase.co", serviceKey: "x".repeat(40) });
    assert.equal(r.status, 502);
    const info = await sa.get("/api/settings/database");
    assert.equal(info.data.provider, "local");
    assert.match(info.data.schemaSql, /create table if not exists app_alerts/);
  });
});

describe("13. Activity & error logs", () => {
  it("records changes, denied access and failed sign-ins", async () => {
    const { data } = await sa.get("/api/logs/audit?days=1&pageSize=200");
    const actions = new Set(data.entries.map((e) => e.action));
    for (const a of ["auth.setup", "auth.login", "auth.login_failed", "user.create", "role.create", "product.create", "stock.record", "backup.restore"])
      assert.ok(actions.has(a), `missing ${a}`);
    assert.ok(data.entries.some((e) => e.outcome === "denied"), "denied access is logged");
    const update = data.entries.find((e) => e.action === "product.update");
    assert.match(update.details, /Fields:/);
    assert.ok(!JSON.stringify(data).includes(accounts.staff.password), "passwords never appear in logs");
  });

  it("filters by user and outcome", async () => {
    const r = await sa.get(`/api/logs/audit?days=1&user=${ids.staffUser}`);
    assert.ok(r.data.entries.length > 0 && r.data.entries.every((e) => e.userId === ids.staffUser));
    const denied = await sa.get("/api/logs/audit?days=1&outcome=denied");
    assert.ok(denied.data.entries.every((e) => e.outcome === "denied"));
  });

  it("tracks page views and exports CSV safely", async () => {
    await staff.post("/api/logs/track", { type: "page", path: "/products" });
    assert.equal((await staff.post("/api/logs/track", { type: "page", path: "https://evil" })).status, 422);
    await sa.post("/api/products", { sku: `CSV-${rand()}`, name: "=HYPERLINK(\"http://evil\")", costPrice: 1, sellPrice: 1 });
    const csv = await sa.get("/api/logs/audit/export?days=1");
    assert.match(csv.headers.get("content-type"), /text\/csv/);
    assert.ok(csv.text.startsWith("ts,userName,role,action"));
    assert.ok(csv.text.includes("\"'=HYPERLINK"), "formula cells are neutralised");
    assert.ok(!csv.text.includes(",\"=HYPERLINK"));
  });

  it("groups client errors, resolves them, and reopens on recurrence", async () => {
    const report = { message: `TypeError: boom ${rand()}`, stack: "TypeError: boom\n    at Widget (app.js:1:1)", url: `${BASE}/products` };
    assert.equal((await staff.post("/api/logs/client-error", report)).status, 200);
    let groups = (await sa.get("/api/logs/errors?days=1")).data.groups;
    const g = groups.find((x) => x.message === report.message);
    assert.ok(g && g.source === "client" && g.status === "open");
    assert.equal((await staff.patch("/api/logs/errors", { fingerprints: [g.fingerprint], status: "resolved" })).status, 403);
    assert.equal((await sa.patch("/api/logs/errors", { fingerprints: [g.fingerprint], status: "resolved", note: "fixed" })).status, 200);
    await anon.post("/api/logs/client-error", report);
    const detail = await sa.get(`/api/logs/errors/${g.fingerprint}`);
    assert.equal(detail.data.status, "open");
    assert.equal(detail.data.total, 2);
    assert.match(detail.data.note, /Reoccurred/);
  });

  it("logs upstream failures as warnings", async () => {
    const groups = (await sa.get("/api/logs/errors?days=1")).data.groups;
    assert.ok(groups.some((x) => x.source === "upstream" && x.level === "warning"));
  });

  it("validates log settings", async () => {
    assert.equal((await sa.put("/api/logs/settings", { retentionDays: 0, trackPageViews: true })).status, 422);
    assert.equal((await sa.put("/api/logs/settings", { retentionDays: 30, trackPageViews: true })).status, 200);
  });
});

describe("14. Sessions", () => {
  it("sign-out revokes a copied session cookie", async () => {
    const c = new Client("copy");
    await c.login(accounts.admin.email, accounts.admin.password);
    const stolen = c.cookie;
    assert.equal((await c.post("/api/auth/logout")).status, 200);
    const thief = new Client("thief");
    thief.cookie = stolen;
    assert.equal((await thief.get("/api/auth/me")).status, 401);
    assert.equal((await admin.get("/api/auth/me")).status, 200, "other sessions unaffected");
  });

  it("changing a password signs out other sessions", async () => {
    const other = new Client("other-device");
    await other.login(accounts.manager.email, accounts.manager.password);
    const next = strongPw();
    assert.equal((await manager.post("/api/auth/password", { currentPassword: "wrong", newPassword: next })).status, 400);
    assert.equal((await manager.post("/api/auth/password", { currentPassword: accounts.manager.password, newPassword: next })).status, 200);
    assert.equal((await manager.get("/api/auth/me")).status, 200, "current session re-issued");
    assert.equal((await other.get("/api/auth/me")).status, 401, "other device signed out");
    accounts.manager.password = next;
  });

  it("deactivating a user ends their session immediately", async () => {
    await sa.patch(`/api/users/${ids.staffUser}`, { active: false });
    assert.equal((await staff.get("/api/auth/me")).status, 401);
    const login = await anon.post("/api/auth/login", accounts.staff);
    assert.equal(login.status, 403);
    await sa.patch(`/api/users/${ids.staffUser}`, { active: true });
    await staff.login(accounts.staff.email, accounts.staff.password);
  });

  it("an admin password reset signs the user out", async () => {
    const pw = strongPw();
    assert.equal((await admin.post(`/api/users/${ids.staffUser}/password`, { password: pw })).status, 204);
    assert.equal((await staff.get("/api/auth/me")).status, 401);
    await staff.login(accounts.staff.email, pw);
  });
});

describe("15. Clear all data", () => {
  it("clears inventory but keeps users, roles and settings", async () => {
    const r = await admin.post("/api/reset");
    assert.equal(r.status, 200);
    assert.equal((await sa.get("/api/products")).data.length, 0);
    assert.equal((await sa.get("/api/alerts")).data.items.length, 0);
    assert.equal((await staff.get("/api/auth/me")).status, 200);
    assert.ok((await sa.get("/api/roles")).data.some((x) => x.name === "Manager"));
  });

  it("rate-limits anonymous error reports", async () => {
    const codes = [];
    for (let i = 0; i < 35; i++) codes.push((await anon.post("/api/logs/client-error", { message: `spam ${i}` })).status);
    assert.ok(codes.includes(429));
  });
});

describe("16. Regression: partial updates", () => {
  it("PATCH only changes the fields that were sent", async () => {
    const c = await sa.post("/api/categories", { name: `Keep ${rand()}` });
    const p = await sa.post("/api/products", {
      sku: `PATCH-${rand()}`, name: "Patch me", costPrice: 3, sellPrice: 4, quantity: 1, reorderLevel: 7, unit: "box",
      categoryId: c.data.id, description: "keep this",
    });
    const r = await sa.patch(`/api/products/${p.data.id}`, { name: "Patched" });
    assert.equal(r.status, 200);
    assert.equal(r.data.name, "Patched");
    assert.equal(r.data.reorderLevel, 7);
    assert.equal(r.data.unit, "box");
    assert.equal(r.data.categoryId, c.data.id);
    assert.equal(r.data.description, "keep this");
    const cleared = await sa.patch(`/api/products/${p.data.id}`, { categoryId: null });
    assert.equal(cleared.data.categoryId, null, "explicit null still clears");
  });
});
