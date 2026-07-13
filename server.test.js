const request = require("supertest");
const jwt = require("jsonwebtoken");
const { app, USERS, ORGS, BOARDS, ISSUES, resetState } = require("./server");

beforeEach(() => {
    resetState();
});

function makeToken(userId) {
    return jwt.sign({ userId }, "key");
}

// ── Auth Middleware ──────────────────────────────────────────

describe("Auth Middleware", () => {
    it("rejects request with no token", async () => {
        const res = await request(app).get("/boards");
        expect(res.status).toBe(401);
        expect(res.body.message).toBe("you are not logged in");
    });

    it("rejects request with invalid token", async () => {
        const res = await request(app)
            .get("/boards")
            .set("token", "garbage");
        expect(res.status).toBe(403);
        expect(res.body.message).toBe("invalid token");
    });
});

// ── GET / ────────────────────────────────────────────────────

describe("GET /", () => {
    it("returns 200", async () => {
        const res = await request(app).get("/");
        expect(res.status).toBe(200);
    });
});

// ── Signup / Signin ──────────────────────────────────────────

describe("POST /signup", () => {
    it("creates a new user", async () => {
        const res = await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe("the user has been added");
    });

    it("rejects missing fields", async () => {
        const res = await request(app)
            .post("/signup")
            .send({ username: "alice" });
        expect(res.status).toBe(400);
    });

    it("rejects duplicate username", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const res = await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        expect(res.status).toBe(409);
    });
});

describe("POST /signin", () => {
    it("returns a token for valid credentials", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const res = await request(app)
            .post("/signin")
            .send({ username: "alice", password: "pass" });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
    });

    it("rejects wrong credentials", async () => {
        const res = await request(app)
            .post("/signin")
            .send({ username: "nobody", password: "bad" });
        expect(res.status).toBe(401);
    });
});

// ── Orgs ─────────────────────────────────────────────────────

describe("POST /create-org", () => {
    it("creates an org", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        const res = await request(app)
            .post("/create-org")
            .set("token", token)
            .send({ title: "My Org" });
        expect(res.status).toBe(200);
        expect(res.body.orgId).toBe(1);
    });

    it("rejects unauthenticated user", async () => {
        const res = await request(app)
            .post("/create-org")
            .send({ title: "My Org" });
        expect(res.status).toBe(401);
    });
});

describe("GET /orgs", () => {
    it("returns orgs the user belongs to", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", token)
            .send({ title: "My Org" });

        const res = await request(app)
            .get("/orgs")
            .set("token", token);
        expect(res.status).toBe(200);
        expect(res.body.orgs).toHaveLength(1);
    });
});

describe("DELETE /org", () => {
    it("admin can delete their org", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", token)
            .send({ title: "My Org" });

        const res = await request(app)
            .delete("/org")
            .set("token", token)
            .send({ orgId: 1 });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe("org deleted");
    });

    it("non-admin cannot delete org", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        await request(app)
            .post("/signup")
            .send({ username: "bob", password: "pass" });
        const aliceToken = makeToken(1);
        const bobToken = makeToken(2);

        await request(app)
            .post("/create-org")
            .set("token", aliceToken)
            .send({ title: "My Org" });

        const res = await request(app)
            .delete("/org")
            .set("token", bobToken)
            .send({ orgId: 1 });
        expect(res.status).toBe(403);
    });
});

// ── Members ──────────────────────────────────────────────────

describe("POST /add-member-to-org", () => {
    it("admin adds a member", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        await request(app)
            .post("/signup")
            .send({ username: "bob", password: "pass" });
        const aliceToken = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", aliceToken)
            .send({ title: "My Org" });

        const res = await request(app)
            .post("/add-member-to-org")
            .set("token", aliceToken)
            .send({ orgId: 1, memberId: 2 });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe("member added");
    });

    it("non-admin cannot add members", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        await request(app)
            .post("/signup")
            .send({ username: "bob", password: "pass" });
        const aliceToken = makeToken(1);
        const bobToken = makeToken(2);

        await request(app)
            .post("/create-org")
            .set("token", aliceToken)
            .send({ title: "My Org" });

        const res = await request(app)
            .post("/add-member-to-org")
            .set("token", bobToken)
            .send({ orgId: 1, memberId: 2 });
        expect(res.status).toBe(403);
    });

    it("cannot add non-existent user", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const aliceToken = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", aliceToken)
            .send({ title: "My Org" });

        const res = await request(app)
            .post("/add-member-to-org")
            .set("token", aliceToken)
            .send({ orgId: 1, memberId: 999 });
        expect(res.status).toBe(403);
    });

    it("cannot add duplicate member", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        await request(app)
            .post("/signup")
            .send({ username: "bob", password: "pass" });
        const aliceToken = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", aliceToken)
            .send({ title: "My Org" });

        await request(app)
            .post("/add-member-to-org")
            .set("token", aliceToken)
            .send({ orgId: 1, memberId: 2 });

        const res = await request(app)
            .post("/add-member-to-org")
            .set("token", aliceToken)
            .send({ orgId: 1, memberId: 2 });
        expect(res.status).toBe(409);
    });
});

describe("GET /members", () => {
    it("returns org members for authorized user", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        await request(app)
            .post("/signup")
            .send({ username: "bob", password: "pass" });
        const aliceToken = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", aliceToken)
            .send({ title: "My Org" });

        await request(app)
            .post("/add-member-to-org")
            .set("token", aliceToken)
            .send({ orgId: 1, memberId: 2 });

        const res = await request(app)
            .get("/members?orgId=1")
            .set("token", aliceToken);
        expect(res.status).toBe(200);
        expect(res.body.members).toHaveLength(1);
        expect(res.body.members[0].username).toBe("bob");
    });

    it("returns 404 for non-existent org", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const aliceToken = makeToken(1);

        const res = await request(app)
            .get("/members?orgId=999")
            .set("token", aliceToken);
        expect(res.status).toBe(404);
    });

    it("returns 403 for non-member", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        await request(app)
            .post("/signup")
            .send({ username: "bob", password: "pass" });
        const aliceToken = makeToken(1);
        const bobToken = makeToken(2);

        await request(app)
            .post("/create-org")
            .set("token", aliceToken)
            .send({ title: "My Org" });

        const res = await request(app)
            .get("/members?orgId=1")
            .set("token", bobToken);
        expect(res.status).toBe(403);
    });
});

describe("PUT /members", () => {
    it("admin can remove a member", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        await request(app)
            .post("/signup")
            .send({ username: "bob", password: "pass" });
        const aliceToken = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", aliceToken)
            .send({ title: "My Org" });

        await request(app)
            .post("/add-member-to-org")
            .set("token", aliceToken)
            .send({ orgId: 1, memberId: 2 });

        const res = await request(app)
            .put("/members")
            .set("token", aliceToken)
            .send({ orgId: 1, memberId: 2 });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe("member removed");
    });

    it("non-admin cannot remove members", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        await request(app)
            .post("/signup")
            .send({ username: "bob", password: "pass" });
        const aliceToken = makeToken(1);
        const bobToken = makeToken(2);

        await request(app)
            .post("/create-org")
            .set("token", aliceToken)
            .send({ title: "My Org" });

        await request(app)
            .post("/add-member-to-org")
            .set("token", aliceToken)
            .send({ orgId: 1, memberId: 2 });

        const res = await request(app)
            .put("/members")
            .set("token", bobToken)
            .send({ orgId: 1, memberId: 1 });
        expect(res.status).toBe(403);
    });
});

// ── Boards ───────────────────────────────────────────────────

describe("POST /board", () => {
    it("creates a board in an org", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", token)
            .send({ title: "My Org" });

        const res = await request(app)
            .post("/board")
            .set("token", token)
            .send({ orgId: 1, title: "Sprint 1" });
        expect(res.status).toBe(200);
        expect(res.body.boardId).toBeDefined();
    });

    it("rejects board in non-existent org", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        const res = await request(app)
            .post("/board")
            .set("token", token)
            .send({ orgId: 999, title: "Sprint 1" });
        expect(res.status).toBe(404);
    });

    it("rejects non-member creating board", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        await request(app)
            .post("/signup")
            .send({ username: "bob", password: "pass" });
        const aliceToken = makeToken(1);
        const bobToken = makeToken(2);

        await request(app)
            .post("/create-org")
            .set("token", aliceToken)
            .send({ title: "My Org" });

        const res = await request(app)
            .post("/board")
            .set("token", bobToken)
            .send({ orgId: 1, title: "Sprint 1" });
        expect(res.status).toBe(403);
    });
});

describe("GET /boards", () => {
    it("returns boards for user's orgs", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", token)
            .send({ title: "My Org" });

        await request(app)
            .post("/board")
            .set("token", token)
            .send({ orgId: 1, title: "Sprint 1" });

        const res = await request(app)
            .get("/boards")
            .set("token", token);
        expect(res.status).toBe(200);
        expect(res.body.boards).toHaveLength(1);
    });
});

describe("DELETE /board", () => {
    it("admin can delete a board", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", token)
            .send({ title: "My Org" });

        await request(app)
            .post("/board")
            .set("token", token)
            .send({ orgId: 1, title: "Sprint 1" });

        const res = await request(app)
            .delete("/board")
            .set("token", token)
            .send({ boardId: 1 });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe("board deleted");
    });

    it("non-admin cannot delete board", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        await request(app)
            .post("/signup")
            .send({ username: "bob", password: "pass" });
        const aliceToken = makeToken(1);
        const bobToken = makeToken(2);

        await request(app)
            .post("/create-org")
            .set("token", aliceToken)
            .send({ title: "My Org" });

        await request(app)
            .post("/board")
            .set("token", aliceToken)
            .send({ orgId: 1, title: "Sprint 1" });

        const res = await request(app)
            .delete("/board")
            .set("token", bobToken)
            .send({ boardId: 1 });
        expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent board", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        const res = await request(app)
            .delete("/board")
            .set("token", token)
            .send({ boardId: 999 });
        expect(res.status).toBe(404);
    });
});

// ── Issues ───────────────────────────────────────────────────

describe("POST /issue", () => {
    it("creates an issue on a board", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", token)
            .send({ title: "My Org" });

        await request(app)
            .post("/board")
            .set("token", token)
            .send({ orgId: 1, title: "Sprint 1" });

        const res = await request(app)
            .post("/issue")
            .set("token", token)
            .send({ boardId: 1, title: "Bug #1", description: "something broken" });
        expect(res.status).toBe(200);
        expect(res.body.issueId).toBeDefined();
    });

    it("rejects issue on non-existent board", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        const res = await request(app)
            .post("/issue")
            .set("token", token)
            .send({ boardId: 999, title: "Bug #1" });
        expect(res.status).toBe(404);
    });

    it("rejects non-member creating issue", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        await request(app)
            .post("/signup")
            .send({ username: "bob", password: "pass" });
        const aliceToken = makeToken(1);
        const bobToken = makeToken(2);

        await request(app)
            .post("/create-org")
            .set("token", aliceToken)
            .send({ title: "My Org" });

        await request(app)
            .post("/board")
            .set("token", aliceToken)
            .send({ orgId: 1, title: "Sprint 1" });

        const res = await request(app)
            .post("/issue")
            .set("token", bobToken)
            .send({ boardId: 1, title: "Bug #1" });
        expect(res.status).toBe(403);
    });

    it("defaults status to todo", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", token)
            .send({ title: "My Org" });

        await request(app)
            .post("/board")
            .set("token", token)
            .send({ orgId: 1, title: "Sprint 1" });

        await request(app)
            .post("/issue")
            .set("token", token)
            .send({ boardId: 1, title: "Bug #1" });

        expect(ISSUES[0].status).toBe("todo");
    });
});

describe("PUT /issue", () => {
    it("updates issue status", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", token)
            .send({ title: "My Org" });

        await request(app)
            .post("/board")
            .set("token", token)
            .send({ orgId: 1, title: "Sprint 1" });

        await request(app)
            .post("/issue")
            .set("token", token)
            .send({ boardId: 1, title: "Bug #1" });

        const res = await request(app)
            .put("/issue")
            .set("token", token)
            .send({ issueId: 1, status: "done" });
        expect(res.status).toBe(200);
        expect(res.body.issue.status).toBe("done");
    });

    it("updates issue title and description", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", token)
            .send({ title: "My Org" });

        await request(app)
            .post("/board")
            .set("token", token)
            .send({ orgId: 1, title: "Sprint 1" });

        await request(app)
            .post("/issue")
            .set("token", token)
            .send({ boardId: 1, title: "Bug #1" });

        const res = await request(app)
            .put("/issue")
            .set("token", token)
            .send({ issueId: 1, title: "Fixed Bug", description: "all good" });
        expect(res.status).toBe(200);
        expect(res.body.issue.title).toBe("Fixed Bug");
        expect(res.body.issue.description).toBe("all good");
    });

    it("returns 404 for non-existent issue", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        const res = await request(app)
            .put("/issue")
            .set("token", token)
            .send({ issueId: 999, status: "done" });
        expect(res.status).toBe(404);
    });

    it("non-member cannot update issue", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        await request(app)
            .post("/signup")
            .send({ username: "bob", password: "pass" });
        const aliceToken = makeToken(1);
        const bobToken = makeToken(2);

        await request(app)
            .post("/create-org")
            .set("token", aliceToken)
            .send({ title: "My Org" });

        await request(app)
            .post("/board")
            .set("token", aliceToken)
            .send({ orgId: 1, title: "Sprint 1" });

        await request(app)
            .post("/issue")
            .set("token", aliceToken)
            .send({ boardId: 1, title: "Bug #1" });

        const res = await request(app)
            .put("/issue")
            .set("token", bobToken)
            .send({ issueId: 1, status: "done" });
        expect(res.status).toBe(403);
    });
});

describe("DELETE /issue", () => {
    it("deletes an issue", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        await request(app)
            .post("/create-org")
            .set("token", token)
            .send({ title: "My Org" });

        await request(app)
            .post("/board")
            .set("token", token)
            .send({ orgId: 1, title: "Sprint 1" });

        await request(app)
            .post("/issue")
            .set("token", token)
            .send({ boardId: 1, title: "Bug #1" });

        const res = await request(app)
            .delete("/issue")
            .set("token", token)
            .send({ issueId: 1 });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe("issue deleted");
        expect(ISSUES).toHaveLength(0);
    });

    it("returns 404 for non-existent issue", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        const token = makeToken(1);

        const res = await request(app)
            .delete("/issue")
            .set("token", token)
            .send({ issueId: 999 });
        expect(res.status).toBe(404);
    });

    it("non-member cannot delete issue", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        await request(app)
            .post("/signup")
            .send({ username: "bob", password: "pass" });
        const aliceToken = makeToken(1);
        const bobToken = makeToken(2);

        await request(app)
            .post("/create-org")
            .set("token", aliceToken)
            .send({ title: "My Org" });

        await request(app)
            .post("/board")
            .set("token", aliceToken)
            .send({ orgId: 1, title: "Sprint 1" });

        await request(app)
            .post("/issue")
            .set("token", aliceToken)
            .send({ boardId: 1, title: "Bug #1" });

        const res = await request(app)
            .delete("/issue")
            .set("token", bobToken)
            .send({ issueId: 1 });
        expect(res.status).toBe(403);
    });
});

// ── Users ────────────────────────────────────────────────────

describe("GET /users", () => {
    it("returns all users without passwords", async () => {
        await request(app)
            .post("/signup")
            .send({ username: "alice", password: "pass" });
        await request(app)
            .post("/signup")
            .send({ username: "bob", password: "pass" });
        const token = makeToken(1);

        const res = await request(app)
            .get("/users")
            .set("token", token);
        expect(res.status).toBe(200);
        expect(res.body.users).toHaveLength(2);
        expect(res.body.users[0]).not.toHaveProperty("password");
    });
});
