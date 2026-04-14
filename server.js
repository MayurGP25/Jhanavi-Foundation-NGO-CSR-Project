require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");

const authRoutes = require("./routes/authRoutes");
const beneficiaryRoutes = require("./routes/beneficiaryRoutes");
const jobProviderRoutes = require("./routes/jobproviderRoutes");
const jobMatchingRoutes = require("./routes/jobMatchingRoutes");
const { requireLogin } = require("./middleware/authMiddleware");
const db = require("./config/db");

const app = express();

// Core middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Session must come before any routes that use req.session
app.use(session({
    secret: "jhanavi_foundation_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 }
}));

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Migrate occupation_id column to VARCHAR to support multiple selections
(async () => {
    // occupation_id was originally INT; changed to VARCHAR(100) so that
    // multiple occupation IDs can be stored as a comma-separated string.
    try {
        await db.query(
            "ALTER TABLE beneficiaries MODIFY COLUMN occupation_id VARCHAR(100)"
        );
    } catch (err) {
        // Ignore if already VARCHAR or column does not exist
    }
    try {
        await db.query(
            "ALTER TABLE beneficiaries ADD COLUMN native_place VARCHAR(255)"
        );
    } catch (err) {
        //Ignore if already VARCHAR or column does not exist
    }

    // marital_status was originally an ENUM('Single','Married').  Converting
    // to VARCHAR(20) allows all four values — Unmarried, Married, Divorced,
    // Widowed — without needing to extend the ENUM definition.
    try {
        await db.query(
            "ALTER TABLE beneficiaries MODIFY COLUMN marital_status VARCHAR(20)"
        );
    } catch (err) {
        // Silently skip — column is already VARCHAR or does not exist
    }
})();

// Landing
app.get("/", (req, res) => res.render("index"));

// Dashboard
app.get("/dashboard", requireLogin, (req, res) => {
    res.render("dashboard", { user: req.session.user });
});

// Route modules (after session)
app.use("/", authRoutes);
app.use("/beneficiaries", beneficiaryRoutes);
app.use("/jobproviders", jobProviderRoutes);
app.use("/jobmatching", jobMatchingRoutes);

// app.listen(3000, () => console.log("Server running at http://localhost:3000"));
export default app;
