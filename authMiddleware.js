const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
    const token = req.headers.token;

    if (!token) {
        return res.status(401).json({
            message: "you are not logged in",
        });
    }

    try {
        const decoded = jwt.verify(token, "key");
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(403).json({
            message: "invalid token",
        });
    }
}

module.exports = {
    authMiddleware,
};