const express = require("express");
const jwt = require("jsonwebtoken");
const { authMiddleware } = require("./authMiddleware");

const app = express();
app.use(express.json());

let userId = 1,
    orgId = 1,
    boardId = 1,
    issueId = 1;

const USERS = [];
const ORGS = []; // id title admin members
const BOARDS = []; // id title orgId issues
const ISSUES = []; // id title description boardId status

// get endpoints
app.get("/", (req, res) => {
    res.json({
        message: "server is running",
    });
});

app.get("/boards", authMiddleware, (req, res) => {
    const currentUserId = parseInt(req.userId);

    const userOrgs = ORGS.filter((o) => {
        return o.admin === currentUserId || o.members.find((m) => m.userId === currentUserId);
    });

    const orgIds = userOrgs.map((o) => o.orgId);
    const boards = BOARDS.filter((b) => orgIds.includes(b.orgId));

    res.json({
        boards,
    });
});

app.get("/members", authMiddleware, (req, res) => {
    const currentUserId = parseInt(req.userId);
    const orgId = parseInt(req.query.orgId);

    const org = ORGS.find((o) => o.orgId === orgId);

    if (!org) {
        return res.status(404).json({
            message: "org not found",
        });
    }

    const isMember = org.admin === currentUserId || org.members.find((m) => m.userId === currentUserId);

    if (!isMember) {
        return res.status(403).json({
            message: "you are not a member of this org",
        });
    }

    res.json({
        members: org.members,
    });
});

app.get("/orgs", authMiddleware, (req, res) => {
    const currentUserId = parseInt(req.userId);

    const orgs = ORGS.filter((o) => {
        return o.admin === currentUserId || o.members.find((m) => m.userId === currentUserId);
    });

    res.json({
        orgs,
    });
});

// post endpoints
app.post("/signup", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    if (!username || !password) {
        return res.status(400).json({
            message: "username and password are required",
        });
    }

    const userExists = USERS.find((u) => u.username === username);

    if (userExists) {
        return res.status(409).json({
            message: "the user already exists",
        });
    }

    USERS.push({
        username,
        password,
        userId: userId++,
    });

    res.json({
        message: "the user has been added",
    });
});

app.post("/signin", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    const userExists = USERS.find(
        (u) => u.username === username && u.password === password,
    );

    if (!userExists) {
        return res.status(401).json({
            message: "wrong credentials",
        });
    }

    const token = jwt.sign(
        {
            userId: userExists.userId,
        },
        "key",
    );

    res.json({
        token,
    });
});

app.post("/create-org", authMiddleware, (req, res) => {
    const currentUserId = parseInt(req.userId);

    const userExists = USERS.find((u) => u.userId === currentUserId);

    if (!userExists) {
        return res.status(403).json({
            message: "your id is invalid",
        });
    }

    ORGS.push({
        orgId: orgId++,
        title: req.body.title,
        admin: currentUserId,
        members: [],
    });

    res.json({
        message: "org created",
        orgId: orgId - 1,
    });
});

app.post("/add-member-to-org", authMiddleware, (req, res) => {
    const currentUserId = parseInt(req.userId);
    const orgId = parseInt(req.body.orgId);
    const memberId = parseInt(req.body.memberId);

    const org = ORGS.find((o) => o.admin === currentUserId && o.orgId === orgId);

    if (!org) {
        return res.status(403).json({
            message: "you are not an admin",
        });
    }

    const memberExists = USERS.find((u) => u.userId === memberId);

    if (!memberExists) {
        return res.status(403).json({
            message: "the member does not exist",
        });
    }

    const alreadyMember = org.members.find((m) => m.userId === memberId);

    if (alreadyMember) {
        return res.status(409).json({
            message: "member already added",
        });
    }

    org.members.push({
        userId: memberExists.userId,
        username: memberExists.username,
    });

    return res.status(200).json({
        message: "member added",
        ORGS,
    });
});

app.post("/board", authMiddleware, (req, res) => {
    const currentUserId = parseInt(req.userId);
    const orgId = parseInt(req.body.orgId);

    const org = ORGS.find((o) => o.orgId === orgId);

    if (!org) {
        return res.status(404).json({
            message: "org not found",
        });
    }

    const isMember = org.admin === currentUserId || org.members.find((m) => m.userId === currentUserId);

    if (!isMember) {
        return res.status(403).json({
            message: "you are not a member of this org",
        });
    }

    BOARDS.push({
        boardId: boardId++,
        orgId,
        title: req.body.title,
        issues: [],
    });

    res.json({
        message: "board created",
        boardId: boardId - 1,
    });
});

app.post("/issue", authMiddleware, (req, res) => {
    const currentUserId = parseInt(req.userId);
    const boardId = parseInt(req.body.boardId);

    const board = BOARDS.find((b) => b.boardId === boardId);

    if (!board) {
        return res.status(404).json({
            message: "board not found",
        });
    }

    const org = ORGS.find((o) => o.orgId === board.orgId);
    const isMember = org.admin === currentUserId || org.members.find((m) => m.userId === currentUserId);

    if (!isMember) {
        return res.status(403).json({
            message: "you are not a member of this org",
        });
    }

    const issue = {
        issueId: issueId++,
        boardId,
        title: req.body.title,
        description: req.body.description || "",
        status: req.body.status || "todo",
    };

    ISSUES.push(issue);
    board.issues.push(issue);

    res.json({
        message: "issue created",
        issueId: issue.issueId,
    });
});

// put endpoints
app.put("/members", authMiddleware, (req, res) => {
    const currentUserId = parseInt(req.userId);
    const orgId = parseInt(req.body.orgId);
    const memberId = parseInt(req.body.memberId);

    const org = ORGS.find((o) => o.orgId === orgId && o.admin === currentUserId);

    if (!org) {
        return res.status(403).json({
            message: "you are not an admin",
        });
    }

    org.members = org.members.filter((m) => m.userId !== memberId);

    res.json({
        message: "member removed",
        org,
    });
});

// delete endpoints
app.delete("/org", authMiddleware, (req, res) => {
    const currentUserId = parseInt(req.userId);
    const orgId = parseInt(req.body.orgId);

    const orgIndex = ORGS.findIndex((o) => o.orgId === orgId && o.admin === currentUserId);

    if (orgIndex === -1) {
        return res.status(403).json({
            message: "you are not an admin",
        });
    }

    ORGS.splice(orgIndex, 1);

    res.json({
        message: "org deleted",
    });
});

app.delete("/board", authMiddleware, (req, res) => {
    const currentUserId = parseInt(req.userId);
    const boardId = parseInt(req.body.boardId);

    const board = BOARDS.find((b) => b.boardId === boardId);

    if (!board) {
        return res.status(404).json({
            message: "board not found",
        });
    }

    const org = ORGS.find((o) => o.orgId === board.orgId);

    if (!org || org.admin !== currentUserId) {
        return res.status(403).json({
            message: "you are not an admin",
        });
    }

    const boardIndex = BOARDS.findIndex((b) => b.boardId === boardId);
    BOARDS.splice(boardIndex, 1);

    res.json({
        message: "board deleted",
    });
});

app.listen(
    3000,
    console.log("the server has been started at http://localhost:3000"),
);
