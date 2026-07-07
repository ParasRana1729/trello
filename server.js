const express = require("express");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const userId = 1,
    orgId = 1,
    boardId = 1,
    issueId = 1;
const USERS = [];
const ORGS = [];
const BOARDS = [];
const ISSUES = [];

// get endpoints
app.get("/", (req, res) => {});

app.get("/boards", (req, res) => {});

app.get("/members", (req, res) => {});

// post endpoints
app.post("/signup", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    const userExists = USERS.find((u) => u.username === username);

    if (userExists) {
        res.status(409).json({
            // 409 - conflict status code
            message: "the user already exists",
        });
    }

    USERS.push({
        username,
        password,
        userId: userId++,
    });

    res.json({
        message: "the user have been added",
    });
});

app.post("/signin", (req, res) => {});

app.post("/org", (req, res) => {});

app.post("/board", (req, res) => {});

app.post("/issue", (req, res) => {});

// put endpoints
app.put("/members", (req, res) => {});

// delete endpoints
app.delete("/org", (req, res) => {});

app.delete("/board", (req, res) => {});
