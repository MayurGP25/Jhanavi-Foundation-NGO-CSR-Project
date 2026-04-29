const express = require("express");
const router = express.Router();

const { requireLogin } = require("../middleware/authMiddleware");
const jobMatching = require("../controllers/jobMatchingController");

// List jobs to match
router.get("/", requireLogin, jobMatching.listJobs);

// View all matched beneficiaries
router.get("/matched", requireLogin, jobMatching.listMatches);

// View detail of a specific match
router.get("/matched/:beneficiaryId", requireLogin, jobMatching.viewMatchDetail);

// View beneficiaries relevant to a job (Recommended + Other)
router.get("/:providerId", requireLogin, jobMatching.viewBeneficiariesForJob);

// Create a match
router.post("/:providerId/match/:beneficiaryId", requireLogin, jobMatching.createMatch);

module.exports = router;