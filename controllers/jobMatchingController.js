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