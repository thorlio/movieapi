const jwtSecret = "your_jwt_secret";

const jwt = require("jsonwebtoken"),
  passport = require("passport");
require("./passport");

let generateJWTToken = (user) => {
  return jwt.sign(user, jwtSecret, {
    subject: user.Username,
    expiresIn: "7d",
    algorithm: "HS256",
  });
};

module.exports = (router) => {
  router.post("/login", (req, res) => {
    passport.authenticate("local", { session: false }, (error, user, info) => {
      if (error) {
        console.error("Error during login:", error);
        return res
          .status(500)
          .json({ message: "Internal server error", error });
      }

      if (!user) {
        console.log("Authentication failed:", info.message);
        return res.status(400).json({ message: info.message });
      }

      req.login(user, { session: false }, (error) => {
        if (error) {
          console.error("Error during login:", error);
          return res.status(500).json({ message: "Login failed", error });
        }
        let token = generateJWTToken(user.toJSON());
        return res.json({ user, token });
      });
    })(req, res);
  });
};
