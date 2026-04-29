const db = require("../config/db");

// List jobs available for matching (with job type labels)
exports.listJobs = async (req, res) => {
  try {
    const [jobs] = await db.query(
      `
      SELECT jp.id,
             jp.provider_name AS job_name,
             jp.phone AS contact_number,
             GROUP_CONCAT(DISTINCT jt.job_type_name ORDER BY jt.job_type_name SEPARATOR ', ') AS job_types
      FROM job_providers jp
      LEFT JOIN job_provider_job_types pj ON pj.provider_id = jp.id
      LEFT JOIN job_types jt ON jt.id = pj.job_type_id
      GROUP BY jp.id, jp.provider_name, jp.phone
      ORDER BY jp.id DESC
      `
    );

    res.render("job-matching-list", { jobs });
  } catch (err) {
    console.error(err);
    res.send("Error loading job matching list.");
  }
};

// Show beneficiaries split into Recommended + Other
exports.viewBeneficiariesForJob = async (req, res) => {
  const providerId = req.params.providerId;

  try {
    // Fetch selected job info
    const [[job]] = await db.query(
      `
      SELECT jp.id,
             jp.provider_name AS job_name,
             jp.phone AS contact_number,
             GROUP_CONCAT(DISTINCT jt.job_type_name ORDER BY jt.job_type_name SEPARATOR ', ') AS job_types
      FROM job_providers jp
      LEFT JOIN job_provider_job_types pj ON pj.provider_id = jp.id
      LEFT JOIN job_types jt ON jt.id = pj.job_type_id
      WHERE jp.id = ?
      GROUP BY jp.id, jp.provider_name, jp.phone
      `,
      [providerId]
    );

    if (!job) return res.send("Job not found.");

    // Recommended: unemployed + occupation matches provider job types
    const [recommended] = await db.query(
      `
      SELECT b.id,
             b.beneficiary_name,
             b.employment_status,
             b.occupation_id,
             b.contact_no
      FROM beneficiaries b
      WHERE b.employment_status = 'Unemployed'
        AND b.occupation_id IN (
          SELECT job_type_id
          FROM job_provider_job_types
          WHERE provider_id = ?
        )
      ORDER BY b.beneficiary_name
      `,
      [providerId]
    );

// Other: everyone else, but exclude already employed
const [others] = await db.query(
    `
    SELECT b.id,
           b.beneficiary_name,
           b.employment_status,
           b.occupation_id,
           b.contact_no
    FROM beneficiaries b
    WHERE b.employment_status != 'Employed'
      AND NOT (
        b.employment_status = 'unemployed'
        AND b.occupation_id IN (
          SELECT job_type_id FROM job_provider_job_types WHERE provider_id = ?
        )
      )
    ORDER BY b.beneficiary_name
    `,
    [providerId]
  );

    res.render("job-matching-beneficiaries", {
      job,
      recommended,
      others
    });
  } catch (err) {
    console.error(err);
    res.send("Error loading matching beneficiaries.");
  }
};

// List all matched beneficiaries
exports.listMatches = async (req, res) => {
  const searchQuery = req.query.search || '';
  try {
    let sql = `
      SELECT
        bjm.beneficiary_id,
        bjm.role_in_company,
        bjm.employment_start_date,
        bjm.remarks,
        b.beneficiary_name,
        b.contact_no,
        jp.provider_name
      FROM beneficiary_job_matching bjm
      JOIN beneficiaries b  ON b.id  = bjm.beneficiary_id
      JOIN job_providers  jp ON jp.id = bjm.provider_id
    `;
    const params = [];
    if (searchQuery) {
      sql += ' WHERE b.beneficiary_name LIKE ? OR jp.provider_name LIKE ?';
      params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }
    sql += ' ORDER BY bjm.employment_start_date DESC, b.beneficiary_name';

    const [matches] = await db.query(sql, params);
    res.render('job-matched-list', { matches, searchQuery });
  } catch (err) {
    console.error(err);
    res.send('Error loading matched beneficiaries.');
  }
};

// View detail of a single match
exports.viewMatchDetail = async (req, res) => {
  const beneficiaryId = req.params.beneficiaryId;
  try {
    const [[match]] = await db.query(
      `
      SELECT
        bjm.beneficiary_id,
        bjm.provider_id,
        bjm.role_in_company,
        bjm.employment_start_date,
        bjm.remarks,
        b.beneficiary_name,
        b.contact_no,
        b.occupation_id,
        b.location,
        jp.provider_name,
        jp.contact_person,
        jp.phone,
        jp.city,
        jp.state
      FROM beneficiary_job_matching bjm
      JOIN beneficiaries b  ON b.id  = bjm.beneficiary_id
      JOIN job_providers  jp ON jp.id = bjm.provider_id
      WHERE bjm.beneficiary_id = ?
      `,
      [beneficiaryId]
    );

    if (!match) return res.send('Match record not found.');

    const occIds = String(match.occupation_id || '').split(',').map(s => s.trim()).filter(Boolean);
    let occupationNames = [];
    if (occIds.length) {
      const placeholders = occIds.map(() => '?').join(',');
      const [jtRows] = await db.query(
        `SELECT job_type_name FROM job_types WHERE id IN (${placeholders})`,
        occIds
      );
      occupationNames = jtRows.map(r => r.job_type_name);
    }

    res.render('job-match-detail', { match, occupationNames });
  } catch (err) {
    console.error(err);
    res.send('Error loading match detail.');
  }
};

// Create a match entry in beneficiary_job_matching, mark beneficiary as employed, then return to list
exports.createMatch = async (req, res) => {
    const { providerId, beneficiaryId } = req.params;
    const { role_in_company, employment_start_date, remarks } = req.body;
  
    // optional: wrap in a transaction for consistency
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
  
      await conn.query(
        `
        INSERT INTO beneficiary_job_matching
          (provider_id, beneficiary_id, role_in_company, employment_start_date, remarks)
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          providerId,
          beneficiaryId,
          role_in_company || null,
          employment_start_date || null,
          remarks || null
        ]
      );
  
      await conn.query(
        `UPDATE beneficiaries SET employment_status = 'Employed' WHERE id = ?`,
        [beneficiaryId]
      );
  
      await conn.commit();
  
      // redirect back to job matching list
      res.redirect("/jobmatching");
    } catch (err) {
      await conn.rollback();
      console.error(err);
      res.send("Error creating match entry.");
    } finally {
      conn.release();
    }
  };