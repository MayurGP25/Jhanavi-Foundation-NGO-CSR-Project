const db = require("../config/db"); // your db pool
const multer = require("multer");

// Multer setup for photo upload
const storage = multer.memoryStorage();
const upload = multer({ storage });
exports.showAddForm = async (req, res) => {
    try {
        const [jobTypes] = await db.query("SELECT id, job_type_name FROM job_types ORDER BY id ASC");
        res.render("beneficiary-add", { user: req.session.user, jobTypes });
    } catch (err) {
        console.error(err);
        res.send("Error loading form.");
    }
};

exports.showAddFormPublic = async (req, res) => {
    // UI only: use static jobTypes, no DB
    const jobTypes = [
        { id: 1, job_type_name: "Unskilled" },
        { id: 2, job_type_name: "Skilled" },
        { id: 3, job_type_name: "Self-employed" },
        { id: 4, job_type_name: "Other" }
    ];
    const user = req.session && req.session.user ? req.session.user : null;
    res.render("beneficiary-add", { user, jobTypes });
};


// ...existing code...

// --- Add Beneficiary ---
exports.addBeneficiary = async (req, res) => {
    const {
        beneficiary_name,
        guardian_name,
        age,
        gender,
        education,
        marital_status,
        children_count,
        id_mark,
        location,
        health_status,
        habits,
        occupation_id,
        occupation_place,
        native_place,
        reference_name,
        reference_address,
        contact_no,
        reason_ulb,
        stay_type,
        remarks,
        shelter_name,
        shelter_location,
        ward_no,
        ulb_name,
        agency_name,
        alternate_mobile
    } = req.body;

    const photo = req.file ? req.file.buffer : null;

    // BR23: Only beneficiary_name + Office Use fields + alternate_mobile are mandatory.
    // Coerce blank optional fields to null so the DB INSERT succeeds.
    const orNull = (v) => (v != null && String(v).trim() !== '') ? v : null;

    try {
        await db.query(
            `INSERT INTO beneficiaries
            (beneficiary_name, guardian_name, age, gender, education, marital_status, children_count, id_mark,
             location, health_status, habits, occupation_id, occupation_place, native_place, reference_name, reference_address,
             contact_no, reason_ulb, stay_type, remarks, photo, employment_status,
             shelter_name, shelter_location, ward_no, ulb_name, agency_name, alternate_mobile)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

            [beneficiary_name, orNull(guardian_name), orNull(age), orNull(gender), orNull(education),
             orNull(marital_status), orNull(children_count), orNull(id_mark),
             orNull(location), orNull(health_status), orNull(habits), orNull(occupation_id),
             orNull(occupation_place), orNull(native_place), orNull(reference_name), orNull(reference_address),
             orNull(contact_no), orNull(reason_ulb), orNull(stay_type), orNull(remarks), photo, 'Unemployed',
             shelter_name, shelter_location, ward_no, ulb_name, agency_name, alternate_mobile]
        );

        res.redirect("/beneficiaries/menu");

    } catch (err) {
        console.error(err);
        res.send("Error adding beneficiary.");
    }
};

// --- View Beneficiaries ---
exports.viewBeneficiaries = async (req, res) => {
    const searchQuery = req.query.search || "";
    const gender = req.query.gender || "";
    const marital_status = req.query.marital_status || "";
    const education = req.query.education || "";
    const location = req.query.location || "";
    const health_status = req.query.health_status || "";
    const stay_type = req.query.stay_type || "";
    const min_age = req.query.min_age || "";
    const max_age = req.query.max_age || "";
    const employment_status = req.query.employment_status || "";
    
    try {
      // ...existing code...
let sql = `
  SELECT b.id, b.beneficiary_name, b.age, b.gender, b.location, b.stay_type, b.employment_status
  FROM beneficiaries b
`;
        let params = [];
        let conditions = [];

        if (searchQuery) {
            conditions.push("beneficiary_name LIKE ?");
            params.push(`%${searchQuery}%`);
        }
        if (gender) {
            conditions.push("gender = ?");
            params.push(gender);
        }
        if (marital_status) {
            conditions.push("marital_status = ?");
            params.push(marital_status);
        }
        if (education) {
            conditions.push("education LIKE ?");
            params.push(`%${education}%`);
        }
        if (location) {
            conditions.push("location LIKE ?");
            params.push(`%${location}%`);
        }
        if (health_status) {
            conditions.push("health_status LIKE ?");
            params.push(`%${health_status}%`);
        }
        if (stay_type) {
            conditions.push("stay_type = ?");
            params.push(stay_type);
        }
        if (min_age) {
            conditions.push("age >= ?");
            params.push(min_age);
        }
        if (max_age) {
            conditions.push("age <= ?");
            params.push(max_age);
        }
        if (employment_status === 'Unemployed') {
            conditions.push("(employment_status = ? OR employment_status IS NULL)");
            params.push(employment_status);
        } else if (employment_status) {
            conditions.push("employment_status = ?");
            params.push(employment_status);
        }

        if (conditions.length > 0) {
            sql += " WHERE " + conditions.join(" AND ");
        }

        const [rows] = await db.query(sql, params);

        res.render("beneficiary-view", {
            user: req.session.user,
            beneficiaries: rows,
            searchQuery,
            filters: {
                gender,
                marital_status,
                education,
                location,
                health_status,
                stay_type,
                min_age,
                max_age,
                employment_status
            }
        });

    } catch (err) {
        console.error(err);
        res.send("Error fetching beneficiaries.");
    }
};
exports.downloadPhoto = async (req, res) => {
    const id = req.params.id;
    try {
        const [rows] = await db.query("SELECT photo, beneficiary_name FROM beneficiaries WHERE id = ?", [id]);
        if (rows.length === 0 || !rows[0].photo) return res.status(404).send("Photo not found");

        const safeName = encodeURIComponent(rows[0].beneficiary_name.replace(/[^\w\s-]/g, '').trim()) + '.jpg';
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`);
        res.setHeader('Content-Type', 'image/jpeg');
        res.send(rows[0].photo);

    } catch (err) {
        console.error(err);
        res.status(500).send("Error downloading photo");
    }
};

// Edit Beneficiary - Show List
exports.showEditList = async (req, res) => {
    const searchQuery = req.query.search || "";
    const gender = req.query.gender || "";
    const marital_status = req.query.marital_status || "";
    const education = req.query.education || "";
    const location = req.query.location || "";
    const health_status = req.query.health_status || "";
    const stay_type = req.query.stay_type || "";
    const min_age = req.query.min_age || "";
    const max_age = req.query.max_age || "";
    const employment_status = req.query.employment_status || "";
    
    try {
// ...existing code...
let sql = `
  SELECT b.id, b.beneficiary_name, b.age, b.gender, b.location, b.stay_type, b.employment_status
  FROM beneficiaries b
`;
        let params = [];
        let conditions = [];

        if (searchQuery) {
            conditions.push("beneficiary_name LIKE ?");
            params.push(`%${searchQuery}%`);
        }
        if (gender) {
            conditions.push("gender = ?");
            params.push(gender);
        }
        if (marital_status) {
            conditions.push("marital_status = ?");
            params.push(marital_status);
        }
        if (education) {
            conditions.push("education LIKE ?");
            params.push(`%${education}%`);
        }
        if (location) {
            conditions.push("location LIKE ?");
            params.push(`%${location}%`);
        }
        if (health_status) {
            conditions.push("health_status LIKE ?");
            params.push(`%${health_status}%`);
        }
        if (stay_type) {
            conditions.push("stay_type = ?");
            params.push(stay_type);
        }
        if (min_age) {
            conditions.push("age >= ?");
            params.push(min_age);
        }
        if (max_age) {
            conditions.push("age <= ?");
            params.push(max_age);
        }
        if (employment_status === 'Unemployed') {
            conditions.push("(employment_status = ? OR employment_status IS NULL)");
            params.push(employment_status);
        } else if (employment_status) {
            conditions.push("employment_status = ?");
            params.push(employment_status);
        }

        if (conditions.length > 0) {
            sql += " WHERE " + conditions.join(" AND ");
        }

        const [rows] = await db.query(sql, params);

        res.render("beneficiary-edit-list", {
            user: req.session.user,
            beneficiaries: rows,
            searchQuery,
            filters: {
                gender,
                marital_status,
                education,
                location,
                health_status,
                stay_type,
                min_age,
                max_age,
                employment_status
            }
        });

    } catch (err) {
        console.error(err);
        res.send("Error fetching beneficiaries.");
    }
};

// --- Show Beneficiary Detail ---
exports.showBeneficiaryDetail = async (req, res) => {
    const id = req.params.id;
    try {
        const [jobTypes] = await db.query("SELECT id, job_type_name FROM job_types ORDER BY id ASC");
        const [rows] = await db.query("SELECT * FROM beneficiaries WHERE id = ?", [id]);

        if (rows.length === 0) {
            return res.status(404).send("Beneficiary not found");
        }

        res.render("beneficiary-detail", {
            user: req.session.user,
            beneficiary: rows[0],
            jobTypes
        });

    } catch (err) {
        console.error(err);
        res.send("Error loading beneficiary details.");
    }
};

// --- Show Edit Form ---
exports.showEditForm = async (req, res) => {
    const id = req.params.id;
    try {
        const [jobTypes] = await db.query("SELECT id, job_type_name FROM job_types ORDER BY id ASC");
        const [rows] = await db.query("SELECT * FROM beneficiaries WHERE id = ?", [id]);
        
        if (rows.length === 0) {
            return res.status(404).send("Beneficiary not found");
        }

        res.render("beneficiary-edit-form", {
            user: req.session.user,
            beneficiary: rows[0],
            jobTypes
        });

    } catch (err) {
        console.error(err);
        res.send("Error loading edit form.");
    }
};

// --- Update Beneficiary ---
exports.updateBeneficiary = async (req, res) => {
    const id = req.params.id;
    const {
        beneficiary_name,
        guardian_name,
        age,
        gender,
        education,
        marital_status,
        children_count,
        id_mark,
        location,
        health_status,
        habits,
        occupation_id,
        occupation_place,
        native_place,
        reference_name,
        reference_address,
        contact_no,
        reason_ulb,
        stay_type,
        remarks,
        employment_status,
        shelter_name,
        shelter_location,
        ward_no,
        ulb_name,
        agency_name,
        alternate_mobile
    } = req.body;

    const photo = req.file ? req.file.buffer : null;

    // BR23: Coerce blank optional fields to null (same helper as addBeneficiary).
    const orNull = (v) => (v != null && String(v).trim() !== '') ? v : null;

    try {
        let sql = `UPDATE beneficiaries SET
            beneficiary_name = ?, guardian_name = ?, age = ?, gender = ?, education = ?,
            marital_status = ?, children_count = ?, id_mark = ?, location = ?, health_status = ?,
            habits = ?, occupation_id = ?, occupation_place = ?, native_place = ?, reference_name = ?,
            reference_address = ?, contact_no = ?, reason_ulb = ?, stay_type = ?, remarks = ?, employment_status = ?,
            shelter_name = ?, shelter_location = ?, ward_no = ?, ulb_name = ?, agency_name = ?, alternate_mobile = ?`;

        const params = [
            beneficiary_name, orNull(guardian_name), orNull(age), orNull(gender), orNull(education),
            orNull(marital_status), orNull(children_count), orNull(id_mark), orNull(location),
            orNull(health_status), orNull(habits), orNull(occupation_id),
            orNull(occupation_place), orNull(native_place), orNull(reference_name), orNull(reference_address),
            orNull(contact_no), orNull(reason_ulb), orNull(stay_type), orNull(remarks),
            employment_status || 'Unemployed',
            shelter_name, shelter_location, ward_no, ulb_name, agency_name, alternate_mobile
        ];

        // Only update photo if a new one is uploaded
        if (photo) {
            sql += ", photo = ?";
            params.push(photo);
        }

        sql += " WHERE id = ?";
        params.push(id);

        await db.query(sql, params);

        res.redirect("/beneficiaries/edit");

    } catch (err) {
        console.error(err);
        res.send("Error updating beneficiary.");
    }
};

// ...existing code...

// Delete Beneficiary
exports.deleteBeneficiary = async (req, res) => {
    const id = req.params.id;
    try {
        await db.query("DELETE FROM beneficiaries WHERE id = ?", [id]);
        res.redirect("/beneficiaries/edit");
    } catch (err) {
        console.error(err);
        res.send("Error deleting beneficiary.");
    }
};

module.exports.upload = upload; // export multer for routes
