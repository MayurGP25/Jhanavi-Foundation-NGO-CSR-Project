const express = require("express");
const router = express.Router();
 
const { requireLogin } = require("../middleware/authMiddleware");
const jobProvider = require("../controllers/jobProviderController");
 
// =========================
//  Job Provider Menu
// =========================
router.get("/menu", requireLogin, (req, res) => {
    res.render("jobprovider-menu", { user: req.session.user });
});
 
// =========================
//  Add Job Provider
// =========================
router.get("/add", requireLogin, jobProvider.showAddForm);
router.post("/add", requireLogin, jobProvider.addJobProvider);
 
// =========================
//  View All Job Providers
// =========================
router.get("/view", requireLogin, jobProvider.viewJobProviders);

// =========================
//  Job Provider Detail
// =========================
router.get("/detail/:id", requireLogin, jobProvider.showJobProviderDetail);

// =========================
//  Edit Job Provider
// =========================
router.get("/edit/:id", requireLogin, jobProvider.showEditForm);
router.post("/edit/:id", requireLogin, jobProvider.updateJobProvider);

// =========================
//  Delete Job Provider
// =========================
router.post("/delete/:id", requireLogin, jobProvider.deleteJobProvider);
 
module.exports = router;