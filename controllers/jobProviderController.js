const db = require("../config/db");
 
// at top (no change): const db = require("../config/db");

// helper to normalize selected ids
const normalizeIds = (ids) => {
    if (!ids) return [];
    if (Array.isArray(ids)) return ids;
    if (typeof ids === 'string' && ids.includes(',')) return ids.split(',');
    return [ids];
};

// Show Add Job Provider Form
exports.showAddForm = async (req, res) => {
    try {
        const [jobTypes] = await db.query("SELECT id, job_type_name FROM job_types ORDER BY id");
        res.render("jobprovider-add", { user: req.session.user, jobProvider: null, jobTypes, selectedJobTypeIds: [] });
    } catch (err) {
        console.error(err);
        res.send("Error loading form.");
    }
};

// Add Job Provider
exports.addJobProvider = async (req, res) => {
    const {
        provider_name,
        contact_person,
        phone,
        email,
        address,
        city,
        state,
        pincode,
        notes,
        job_type_ids
    } = req.body;

    const selectedIds = normalizeIds(job_type_ids);

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.query(
            `INSERT INTO job_providers
             (provider_name, contact_person, phone, email, address, city, state, pincode, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [provider_name, contact_person, phone, email, address, city, state, pincode, notes]
        );

        const providerId = result.insertId;

        if (selectedIds.length) {
            const values = selectedIds.map(id => [providerId, id]);
            await conn.query(
                "INSERT INTO job_provider_job_types (provider_id, job_type_id) VALUES ?",
                [values]
            );
        }

        await conn.commit();
        res.redirect("/jobproviders/menu");
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.send("Error adding job provider.");
    } finally {
        conn.release();
    }
};
 
// View all Job Providers
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

        res.render("jobprovider-view", {
            user: req.session.user,
            jobProviders: rows,
            searchQuery
        });
    } catch (err) {
        console.error(err);
        res.send("Error fetching job providers.");
    }
};
 

  
  // SHOW EDIT FORM (preselect existing job types)
  exports.showEditForm = async (req, res) => {
    const id = req.params.id;
  
    try {
      const [rows] = await db.query("SELECT * FROM job_providers WHERE id = ?", [id]);
      if (rows.length === 0) return res.send("Job Provider not found.");
  
      // all job types for dropdown
      const [jobTypes] = await db.query(
        "SELECT id, job_type_name FROM job_types ORDER BY id"
      );
  
      // selected job types for this provider (junction table)
      const [selected] = await db.query(
        "SELECT job_type_id FROM job_provider_job_types WHERE provider_id = ?",
        [id]
      );
      const selectedJobTypeIds = selected.map(r => r.job_type_id);
  
      res.render("jobprovider-add", {
        user: req.session.user,
        jobProvider: rows[0],
        jobTypes,
        selectedJobTypeIds
      });
    } catch (err) {
      console.error(err);
      res.send("Error fetching job provider.");
    }
  };
  
  // UPDATE JOB PROVIDER (update provider + replace job_type mappings)
  exports.updateJobProvider = async (req, res) => {
    const id = req.params.id;
    const {
      provider_name,
      contact_person,
      phone,
      email,
      address,
      city,
      state,
      pincode,
      notes,
      job_type_ids
    } = req.body;
  
    const selectedIds = normalizeIds(job_type_ids);
  
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
  
      await conn.query(
        `UPDATE job_providers
         SET provider_name = ?, contact_person = ?, phone = ?, email = ?, address = ?, city = ?, state = ?, pincode = ?, notes = ?
         WHERE id = ?`,
        [provider_name, contact_person, phone, email, address, city, state, pincode, notes, id]
      );
  
      // replace mappings
      await conn.query("DELETE FROM job_provider_job_types WHERE provider_id = ?", [id]);
  
      if (selectedIds.length) {
        const values = selectedIds.map(jobTypeId => [id, jobTypeId]);
        await conn.query(
          "INSERT INTO job_provider_job_types (provider_id, job_type_id) VALUES ?",
          [values]
        );
      }
  
      await conn.commit();
      res.redirect("/jobproviders/menu");
    } catch (err) {
      await conn.rollback();
      console.error(err);
      res.send("Error updating job provider.");
    } finally {
      conn.release();
    }
  };
 
// Delete Job Provider
exports.deleteJobProvider = async (req, res) => {
    const id = req.params.id;
    try {
        await db.query("DELETE FROM job_providers WHERE id = ?", [id]);
        res.redirect("/jobproviders/view");
 
    } catch (err) {
        console.error(err);
        res.send("Error deleting job provider.");
    }
};