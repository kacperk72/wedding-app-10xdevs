const assert = require("node:assert/strict");
const { afterEach, beforeEach, describe, it } = require("node:test");
const { clearAppCache, close, createTestServer, request } = require("./helpers/http-app");

describe("tasks CRUD", () => {
  let server;
  let db;

  beforeEach(async () => {
    const app = await createTestServer({
      weddings: [
        {
          id: "wedding-1",
          partner_a_name: "Ala",
          partner_b_name: "Jan",
          wedding_date: "2026-07-25",
          ceremony_location: null,
          created_by_user_id: "user-a",
        },
      ],
      tasks: [],
    });
    db = app.db;
    server = app.server;
  });

  afterEach(async () => {
    if (server) await close(server);
    clearAppCache();
  });

  it("returns an empty active list when there are no tasks", async () => {
    const response = await request(server, "GET", "/api/weddings/wedding-1/tasks");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, []);
  });

  it("creates a manual task with MVP defaults", async () => {
    const response = await request(server, "POST", "/api/weddings/wedding-1/tasks", {
      title: "Test 123",
      category: "inne",
      dueDate: "2026-05-27",
      description: "Notatka",
    });

    assert.equal(response.status, 201);
    assert.equal(response.body.title, "Test 123");
    assert.equal(response.body.done, false);
    assert.equal(response.body.isAuto, undefined);
    assert.equal(response.body.templateId, undefined);
    assert.equal(db.tasks[0].wedding_id, "wedding-1");
  });

  it("sets and clears doneAt when done is toggled", async () => {
    db.tasks.push({
      id: "task-1",
      wedding_id: "wedding-1",
      title: "Toggle",
      description: null,
      category: "inne",
      due_date: "2026-05-27",
      done: false,
      done_at: null,
    });

    const done = await request(server, "PATCH", "/api/weddings/wedding-1/tasks/task-1", {
      done: true,
    });
    assert.equal(done.status, 200);
    assert.equal(done.body.done, true);
    assert.match(done.body.doneAt, /^\d{4}-\d{2}-\d{2}T/);

    const undone = await request(server, "PATCH", "/api/weddings/wedding-1/tasks/task-1", {
      done: false,
    });
    assert.equal(undone.status, 200);
    assert.equal(undone.body.done, false);
    assert.equal(undone.body.doneAt, null);
  });

  it("rejects patches for tasks from another wedding", async () => {
    db.tasks.push({
      id: "foreign-task",
      wedding_id: "wedding-2",
      title: "Foreign",
      description: null,
      category: "inne",
      due_date: "2026-05-27",
      done: false,
      done_at: null,
    });

    const response = await request(
      server,
      "PATCH",
      "/api/weddings/wedding-1/tasks/foreign-task",
      { title: "Changed" },
    );

    assert.equal(response.status, 404);
    assert.equal(db.tasks[0].title, "Foreign");
  });

  it("deletes tasks and returns 404 for missing ids", async () => {
    db.tasks.push({
      id: "task-1",
      wedding_id: "wedding-1",
      title: "Delete me",
      description: null,
      category: "inne",
      due_date: "2026-05-27",
      done: false,
      done_at: null,
    });

    const removed = await request(server, "DELETE", "/api/weddings/wedding-1/tasks/task-1");
    assert.equal(removed.status, 204);
    assert.equal(db.tasks.length, 0);

    const missing = await request(server, "DELETE", "/api/weddings/wedding-1/tasks/task-1");
    assert.equal(missing.status, 404);
  });

  it("validates title, category, and dueDate", async () => {
    const missingTitle = await request(server, "POST", "/api/weddings/wedding-1/tasks", {
      category: "inne",
      dueDate: "2026-05-27",
    });
    assert.equal(missingTitle.status, 400);

    const badCategory = await request(server, "POST", "/api/weddings/wedding-1/tasks", {
      title: "Bad",
      category: "catering",
      dueDate: "2026-05-27",
    });
    assert.equal(badCategory.status, 400);

    const badDate = await request(server, "POST", "/api/weddings/wedding-1/tasks", {
      title: "Bad",
      category: "inne",
      dueDate: "27.05.2026",
    });
    assert.equal(badDate.status, 400);
  });
});
