// Route guard — attach to any route that requires a logged-in user.
function requireLogin(req, res, next) {
    // No active session → send to login; route handler never runs.
    if (!req.session.user) {
        return res.redirect("/login");
    }
    // Prevent the browser from caching authenticated pages so the back button
    // cannot reveal protected content after logout.
    res.set("Cache-Control", "no-store");
    next();
}

module.exports = { requireLogin };
