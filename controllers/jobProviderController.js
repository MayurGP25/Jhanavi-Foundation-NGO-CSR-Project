const db = require("../config/db");

// Normalise job_type_ids from the form: handles missing, comma-string, or array formats.
const normalizeIds = (ids) => {
    if (!ids) return [];
    if (Array.isArray(ids)) return ids;
    if (typeof ids === 'string' && ids.includes(',')) return ids.split(',');
    return [ids];
};

// Fields that must be non-empty on both add and update.
const REQUIRED_FIELDS = ['provider_name', 'contact_person', 'phone', 'address', 'city', 'state', 'pincode'];

// Re-render the add/edit form with an inline error message and the submitted values preserved.
async function renderFormWithError(res, errorMessage, jobProvider, selectedJobTypeIds = []) {
    try {
        const [jobTypes] = await db.query("SELECT id, job_type_name FROM job_types ORDER BY id");
        res.render("jobprovider-add", {
            user: null,          // session not available here; header still works via EJS layout
            jobProvider,
            jobTypes,
            selectedJobTypeIds,
            errorMessage
        });
    } catch (dbErr) {
        console.error("Error loading job types for form re-render:", dbErr);
        res.status(500).send("An unexpected error occurred. Please go back and try again.");
    }
}

// ──────────────────────────────────────────────
//  Show Add Form
// ──────────────────────────────────────────────
exports.showAddForm = async (req, res) => {
    try {
        const [jobTypes] = await db.query("SELECT id, job_type_name FROM job_types ORDER BY id");
        res.render("jobprovider-add", {
            user: req.session.user,
            jobProvider: null,
            jobTypes,
            selectedJobTypeIds: [],
            errorMessage: null
        });
    } catch (err) {
        console.error("Error loading add form:", err);
        res.status(500).send("Error loading form.");
    }
};

// ──────────────────────────────────────────────
//  Add Job Provider
// ──────────────────────────────────────────────
exports.addJobProvider = async (req, res) => {
    const { provider_name, contact_person, phone, email, address, city, state, pincode, notes, job_type_ids } = req.body;

    // Server-side required-field guard (HTML `required` can be bypassed via direct POST).
    const missing = REQUIRED_FIELDS.filter(f => !req.body[f]?.trim());
    if (missing.length) {
        return renderFormWithError(res, "Please fill in all required fields.", null, normalizeIds(job_type_ids));
    }

    // Filter out any non-numeric job type IDs to avoid FK constraint failures.
    const selectedIds = normalizeIds(job_type_ids).filter(id => /^\d+$/.test(String(id)));

    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const [result] = await conn.query(
            `INSERT INTO job_providers
             (provider_name, contact_person, phone, email, address, city, state, pincode, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [provider_name, contact_person, phone, email || null, address, city, state, pincode, notes || null]
        );

        const providerId = result.insertId;

        // Insert job-type mappings only when at least one type was selected.
        if (selectedIds.length) {
            const values = selectedIds.map(id => [providerId, id]);
            await conn.query("INSERT INTO job_provider_job_types (provider_id, job_type_id) VALUES ?", [values]);
        }

        await conn.commit();
        res.redirect(`/jobproviders/detail/${providerId}?success=added`);
    } catch (err) {
        if (conn) await conn.rollback();
        console.error("Error adding job provider:", err);
        res.status(500).send("Error adding job provider. Please go back and try again.");
    } finally {
        if (conn) conn.release();
    }
};

// ──────────────────────────────────────────────
//  View All Job Providers (with optional search)
// ──────────────────────────────────────────────
exports.viewJobProviders = async (req, res) => {
    const searchQuery = req.query.search || "";
    try {
        let sql = `
            SELECT
                jp.id,
                jp.provider_name,
                jp.contact_person,
                jp.phone,
                jp.email,
                jp.city,
                jp.state,
                GROUP_CONCAT(DISTINCT jt.job_type_name ORDER BY jt.job_type_name SEPARATOR ', ') AS job_types
            FROM job_providers jp
            LEFT JOIN job_provider_job_types pj ON pj.provider_id = jp.id
            LEFT JOIN job_types jt ON jt.id = pj.job_type_id
        `;
        const params = [];

        if (searchQuery) {
            sql += " WHERE jp.provider_name LIKE ? OR jp.contact_person LIKE ?";
            params.push(`%${searchQuery}%`, `%${searchQuery}%`);
        }

        sql += " GROUP BY jp.id, jp.provider_name, jp.contact_person, jp.phone, jp.email, jp.city, jp.state";
        sql += " ORDER BY jp.id DESC";

        const [rows] = await db.query(sql, params);
        res.render("jobprovider-view", { user: req.session.user, jobProviders: rows, searchQuery });
    } catch (err) {
        console.error("Error fetching job providers:", err);
        res.status(500).send("Error fetching job providers.");
    }
};

// ──────────────────────────────────────────────
//  Show Job Provider Detail (read-only)
// ──────────────────────────────────────────────
exports.showJobProviderDetail = async (req, res) => {
    const id = req.params.id;
    try {
        const [rows] = await db.query("SELECT * FROM job_providers WHERE id = ?", [id]);

        // Provider deleted or never existed — send back to the list instead of a blank page.
        if (rows.length === 0) return res.redirect("/jobproviders/view");

        const [selected] = await db.query(
            `SELECT jt.job_type_name
             FROM job_provider_job_types pj
             JOIN job_types jt ON jt.id = pj.job_type_id
             WHERE pj.provider_id = ?
             ORDER BY jt.job_type_name`,
            [id]
        );
        const selectedJobTypeNames = selected.map(r => r.job_type_name);
        const successMessage = req.query.success || null;

        res.render("jobprovider-detail", {
            user: req.session.user,
            jobProvider: rows[0],
            selectedJobTypeNames,
            successMessage,
            query: req.query
        });
    } catch (err) {
        console.error("Error fetching job provider detail:", err);
        res.status(500).send("Error fetching job provider.");
    }
};

// ──────────────────────────────────────────────
//  Show Edit Form (pre-select existing job types)
// ──────────────────────────────────────────────
exports.showEditForm = async (req, res) => {
    const id = req.params.id;
    try {
        const [rows] = await db.query("SELECT * FROM job_providers WHERE id = ?", [id]);

        // Provider not found — redirect to list rather than showing a broken form.
        if (rows.length === 0) return res.redirect("/jobproviders/view");

        const [jobTypes] = await db.query("SELECT id, job_type_name FROM job_types ORDER BY id");
        const [selected] = await db.query(
            "SELECT job_type_id FROM job_provider_job_types WHERE provider_id = ?",
            [id]
        );
        const selectedJobTypeIds = selected.map(r => r.job_type_id);

        res.render("jobprovider-add", {
            user: req.session.user,
            jobProvider: rows[0],
            jobTypes,
            selectedJobTypeIds,
            errorMessage: null
        });
    } catch (err) {
        console.error("Error loading edit form:", err);
        res.status(500).send("Error fetching job provider.");
    }
};

// ──────────────────────────────────────────────
//  Update Job Provider (replace provider row + job-type mappings atomically)
// ──────────────────────────────────────────────
exports.updateJobProvider = async (req, res) => {
    const id = req.params.id;
    const { provider_name, contact_person, phone, email, address, city, state, pincode, notes, job_type_ids } = req.body;

    // Server-side required-field guard.
    const missing = REQUIRED_FIELDS.filter(f => !req.body[f]?.trim());
    if (missing.length) {
        // Re-render the edit form with the submitted values so the user doesn't lose their work.
        const submitted = { id, provider_name, contact_person, phone, email, address, city, state, pincode, notes };
        return renderFormWithError(res, "Please fill in all required fields.", submitted, normalizeIds(job_type_ids));
    }

    const selectedIds = normalizeIds(job_type_ids).filter(id => /^\d+$/.test(String(id)));

    let conn;
    try {
        conn = await db.getConnection();
        await conn.beginTransaction();

        const [result] = await conn.query(
            `UPDATE job_providers
             SET provider_name = ?, contact_person = ?, phone = ?, email = ?, address = ?, city = ?, state = ?, pincode = ?, notes = ?
             WHERE id = ?`,
            [provider_name, contact_person, phone, email || null, address, city, state, pincode, notes || null, id]
        );

        // If no rows were affected the provider was deleted between loading and saving the form.
        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.redirect("/jobproviders/view");
        }

        // Replace job-type mappings atomically within the same transaction.
        await conn.query("DELETE FROM job_provider_job_types WHERE provider_id = ?", [id]);

        if (selectedIds.length) {
            const values = selectedIds.map(jobTypeId => [id, jobTypeId]);
            await conn.query("INSERT INTO job_provider_job_types (provider_id, job_type_id) VALUES ?", [values]);
        }

        await conn.commit();
        res.redirect(`/jobproviders/detail/${id}?success=updated`);
    } catch (err) {
        if (conn) await conn.rollback();
        console.error("Error updating job provider:", err);
        res.status(500).send("Error updating job provider. Please go back and try again.");
    } finally {
        if (conn) conn.release();
    }
};

// ──────────────────────────────────────────────
//  Delete Job Provider
// ──────────────────────────────────────────────
exports.deleteJobProvider = async (req, res) => {
    const id = req.params.id;
    try {
        await db.query("DELETE FROM job_providers WHERE id = ?", [id]);
        res.redirect("/jobproviders/view");
    } catch (err) {
        // MySQL error 1451: FK constraint — this provider has active job matches.
        // Redirect back to the detail page instead of crashing.
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            console.warn(`Delete blocked for job provider ${id}: active job matches exist.`);
            return res.redirect(`/jobproviders/detail/${id}?error=has_matches`);
        }
        console.error("Error deleting job provider:", err);
        res.status(500).send("Error deleting job provider.");
    }
};
