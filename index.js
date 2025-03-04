require("dotenv").config(); // Load environment variables from .env file

const express = require("express");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const Models = require("./models.js");
const app = express();
const Movies = Models.Movie;
const Users = Models.User;
const cors = require("cors");
const passport = require("passport");
const { check, validationResult } = require("express-validator");
const port = process.env.PORT || 8080;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err.message));

const allowedOrigins = [
  "http://localhost:1234",
  "http://localhost:3000",
  "https://ohmyflix-1cea4b4ad120.herokuapp.com",
  "https://www.movieapi-client.netlify.app",
];

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan("combined"));
app.use(express.static("public"));
app.use("/documentation", express.static("public"));
app.use(
  cors({
    origin: (origin, callback) => {
      console.log("Request Origin:", origin);
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error("Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

let auth = require("./auth.js")(app);

require("./passport.js");

app.get("/", (req, res) => {
  res.status(200).send("Welcome to Flix and Chill App!");
});

const bcrypt = require("bcrypt");

app.post("/register", async (req, res) => {
  try {
    const { Username, Password, Email, Birthday } = req.body;

    if (!Username || !Password || !Email || !Birthday) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUser = await Users.findOne({ Username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(Password, 10);

    const newUser = new Users({
      Username,
      Password: hashedPassword,
      Email,
      Birthday,
    });

    await newUser.save();
    res
      .status(201)
      .json({ message: "User created successfully", user: newUser });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/users", async (req, res) => {
  try {
    const { Username, Password, Email, Birthday } = req.body;

    if (!Username || !Password || !Email || !Birthday) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUser = await Users.findOne({ Username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(Password, 10);

    const newUser = new Users({
      Username,
      Password: hashedPassword,
      Email,
      Birthday,
    });

    await newUser.save();

    res
      .status(201)
      .json({ message: "User created successfully", user: newUser });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/login", async (req, res) => {
  const { Username, Password } = req.body;

  try {
    const user = await Users.findOne({ Username });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const isValidPassword = await user.validatePassword(Password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid password" });
    }

    res.status(200).json({
      user: {
        Username: user.Username,
        Email: user.Email,
      },
    });
  } catch (error) {
    console.error("Login error: ", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all users
app.get(
  "/users",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const users = await Users.find();
      res.status(200).json(users);
    } catch (err) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get user by username
app.get(
  "/users/:username",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    await Users.findOne({ Username: req.params.username })
      .then((user) => {
        if (user) {
          res.status(200).json(user);
        } else {
          res.status(404).json({ error: "User not found" });
        }
      })
      .catch((err) => res.status(500).json({ error: err.message }));
  }
);

app.put(
  "/users/:Username",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    if (req.user.Username !== req.params.Username) {
      return res.status(400).send("Permission denied");
    }

    let updatedFields = {
      Username: req.body.Username,
      Email: req.body.Email,
      Birthday: req.body.Birthday,
    };

    if (req.body.Password) {
      updatedFields.Password = Users.hashPassword(req.body.Password);
    }

    await Users.findOneAndUpdate(
      { Username: req.params.Username },
      { $set: updatedFields },
      { new: true }
    )
      .then((updatedUser) => {
        res.json(updatedUser);
      })
      .catch((err) => {
        console.log(err);
        res.status(500).send("Error: " + err);
      });
  }
);

// Delete a user by Username
app.delete(
  "/users/:Username",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    if (req.user.Username !== req.params.Username) {
      console.error("Permission denied: User mismatch");
      return res.status(403).json({ error: "Permission denied" });
    }

    try {
      const deletedUser = await Users.findOneAndDelete({
        Username: req.params.Username,
      });

      if (!deletedUser) {
        console.error("User not found in database:", req.params.Username);
        return res.status(404).json({ error: "User not found" });
      }

      console.log("User deleted successfully:", deletedUser);
      res.status(200).json({ message: "User deleted successfully" });
    } catch (err) {
      console.error("Error deleting user:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

app.post("/users/:Username/movies/:MovieID", async (req, res) => {
  const { Username, MovieID } = req.params;

  try {
    const updatedUser = await Users.findOneAndUpdate(
      { Username },
      { $addToSet: { FavoriteMovies: MovieID.toString() } }, // Add as a string
      { new: true }
    );

    if (!updatedUser) return res.status(404).send("User not found");

    res.json(updatedUser);
  } catch (error) {
    console.error("Error adding favorite movie:", error);
    res.status(500).send("Internal Server Error while adding favorite movie");
  }
});

app.delete("/users/:Username/movies/:MovieID", async (req, res) => {
  const { Username, MovieID } = req.params;

  try {
    const updatedUser = await Users.findOneAndUpdate(
      { Username },
      { $pull: { FavoriteMovies: MovieID.toString() } },
      { new: true }
    );

    if (!updatedUser) return res.status(404).send("User not found");

    res.json(updatedUser);
  } catch (error) {
    console.error("Error removing favorite movie:", error);
    res.status(500).send("Internal Server Error while removing favorite movie");
  }
});

// app.put(
//   "/users/:Username",
//   passport.authenticate("jwt", { session: false }),
//   async (req, res) => {
//     if (req.user.Username !== req.params.Username) {
//       return res.status(400).send("Permission denied");
//     }
//     let hashedPassword = Users.hashPassword(req.body.Password);
//     await Users.findOneAndUpdate(
//       { Username: req.params.Username },
//       {
//         $set: {
//           Username: req.body.Username,
//           Password: hashedPassword,
//           Email: req.body.Email,
//           Birthday: req.body.Birthday,
//         },
//       },
//       { new: true }
//     )
//       .then((updatedUser) => {
//         res.json(updatedUser);
//       })
//       .catch((err) => {
//         console.log(err);
//         res.status(500).send("Error: " + err);
//       });
//   }
// );

// Get all movies
app.get(
  "/movies",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const movies = await Movies.find();
      res.status(200).json(movies);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Get movie by title
app.get(
  "/movies/:title",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    await Movies.findOne({ title: req.params.title })
      .then((movie) => {
        if (movie) {
          res.status(200).json(movie);
        } else {
          res.status(404).json({ error: "Movie not found" });
        }
      })
      .catch((err) => res.status(500).json({ error: err.message }));
  }
);

// Add a new Movie
app.post(
  "/movies",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const newMovie = new Movies(req.body);
    await newMovie
      .save()
      .then((movie) => res.status(201).json(movie))
      .catch((err) => res.status(400).json({ error: err.message }));
  }
);

// Update a Movie by Title
app.put(
  "/movies/:title",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    await Movies.findOneAndUpdate(
      { title: req.params.title },
      { $set: req.body },
      { new: true }
    )
      .then((movie) => {
        if (movie) {
          res.status(200).json(movie);
        } else {
          res.status(404).json({ error: "Movie not found" });
        }
      })
      .catch((err) => res.status(400).json({ error: err.message }));
  }
);

// Delete a movie by title
app.delete(
  "/movies/:title",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    await Movies.findOneAndRemove({ title: req.params.title })
      .then((result) =>
        res.status(200).json({ message: "Movie deleted", result })
      )
      .catch((err) => res.status(400).json({ error: err.message }));
  }
);

app.listen(port, "0.0.0.0", () => {
  console.log("Listening on Port " + port);
});
