const express = require("express");
const router = express.Router();

const { requireLogin } = require("../middleware/authMiddleware");
const beneficiary = require("../controllers/beneficiaryController");

// =========================
//  Beneficiary Menu
// =========================
router.get("/menu", requireLogin, (req, res) => {
    res.render("beneficiary-menu", { user: req.session.user });
});

// =========================
//  Add Beneficiary
// =========================

// Render Add Form
router.get("/add", requireLogin, beneficiary.showAddForm);

// Render Add Form (public, no login required)
router.get("/add-public", beneficiary.showAddFormPublic);

// Handle Add POST submission
router.post(
    "/add",
    requireLogin,
    beneficiary.upload.single("photo"),  // multer for photo upload
    beneficiary.addBeneficiary
);

// View all beneficiaries
router.get("/view", requireLogin, beneficiary.viewBeneficiaries);
router.get("/detail/:id", requireLogin, beneficiary.showBeneficiaryDetail);
router.get("/photo/:id", requireLogin, beneficiary.downloadPhoto);

// =========================
//  Edit Beneficiary
// =========================

// Show list of beneficiaries for editing
router.get("/edit", requireLogin, beneficiary.showEditList);

// Show edit form for specific beneficiary
router.get("/edit/:id", requireLogin, beneficiary.showEditForm);

// Handle update POST submission
router.post(
    "/edit/:id",
    requireLogin,
    beneficiary.upload.single("photo"),
    beneficiary.updateBeneficiary
);

// Handle delete POST submission
router.post("/delete/:id", requireLogin, beneficiary.deleteBeneficiary);

module.exports = router;
