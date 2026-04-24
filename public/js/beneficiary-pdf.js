// Shared PDF generation for beneficiary forms.
// Called from beneficiary-add.ejs (no argument – reads DOM inputs)
// and from beneficiary-detail.ejs (passes a pre-built data object + photoSrc).
async function generatePDF(prefilled) {
    const { jsPDF } = window.jspdf;

    let d, photoData;

    if (prefilled) {
        d = prefilled.data;
        photoData = prefilled.photoSrc || null;
    } else {
        const hasEmpty = ['beneficiary_name','guardian_name','age','education','id_mark',
            'location','native_place','health_status','habits','occupation_id',
            'occupation_place','reference_name','reference_address','contact_no','reason_ulb','remarks']
            .some(id => !document.getElementById(id)?.value?.trim());

        if (hasEmpty) {
            document.getElementById('pdfErrorBanner')?.remove();
            const b = Object.assign(document.createElement('div'), {
                id: 'pdfErrorBanner',
                className: 'alert alert-danger',
                innerHTML: '&#9888;&#65039; Please fill in all required fields before downloading the form.'
            });
            b.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;min-width:340px;max-width:580px;box-shadow:0 4px 16px rgba(0,0,0,0.18);border-radius:8px;padding:12px 18px;';
            document.body.appendChild(b);
            setTimeout(() => { b.style.transition='opacity 0.4s'; b.style.opacity='0'; setTimeout(()=>b.remove(),400); }, 4000);
            return;
        }

        const occupationText = document.getElementById('occupationDisplay').textContent.replace('Select occupation(s)', '');

        d = {
            beneficiary_name:  document.getElementById('beneficiary_name').value,
            guardian_name:     document.getElementById('guardian_name').value,
            age:               document.getElementById('age').value,
            gender:            document.getElementById('gender').value,
            education:         document.getElementById('education').value,
            marital_status:    document.getElementById('marital_status').value,
            children_count:    document.getElementById('children_count').value,
            id_mark:           document.getElementById('id_mark').value,
            location:          document.getElementById('location').value,
            native_place:      document.getElementById('native_place').value,
            health_status:     document.getElementById('health_status').value,
            habits:            document.getElementById('habits').value,
            occupation_id:     occupationText,
            occupation_place:  document.getElementById('occupation_place').value,
            reference_name:    document.getElementById('reference_name').value,
            reference_address: document.getElementById('reference_address').value,
            contact_no:        document.getElementById('contact_no').value,
            reason_ulb:        document.getElementById('reason_ulb').value,
            stay_type:         document.getElementById('stay_type').value,
            remarks:           document.getElementById('remarks').value,
            shelter:           document.getElementById('shelterName').value,
            shelterLoc:        document.getElementById('shelterLocation').value,
            ulb:               document.getElementById('ulbName').value,
            agency:            document.getElementById('agencyName').value,
            ward:              document.getElementById('wardNo').value,
        };

        photoData = typeof uploadedPhotoData !== 'undefined' ? uploadedPhotoData : null;
    }

    const pageW      = 210;
    const pageH      = 297;
    const marginX    = 10;
    const marginY    = 10;
    const bottomM    = 15;
    const contentW   = pageW - marginX * 2;
    const halfX      = marginX + contentW / 2;
    const halfW      = contentW / 2;
    const availableH = pageH - marginY - bottomM; // 272mm

    // ── layout engine – runs twice: once to measure, once to draw ────────────
    function buildLayout(pdf, scale) {
        const FH       = 8  * scale;
        const secH     = 6.5 * scale;
        const titleH   = 11  * scale;
        const photoW   = 28; // physical passport photo, not scaled
        const photoH   = 4 * FH;
        const nameW    = contentW - photoW;
        const photoX   = marginX + contentW - photoW;
        let y = marginY;

        function sectionBar(title) {
            pdf.setFillColor(210, 210, 215);
            pdf.rect(marginX, y, contentW, secH, 'F');
            pdf.setDrawColor(160); pdf.setLineWidth(0.2);
            pdf.line(marginX, y, marginX + contentW, y);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8 * scale);
            pdf.setTextColor(40);
            pdf.text(title, marginX + 3, y + secH * 0.7);
            pdf.setTextColor(0);
            y += secH;
        }

        function row(label, value, x, w, opts) {
            opts = opts || {};
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8 * scale);
            pdf.setTextColor(opts.labelColor || 70);
            pdf.text(label, x + 2, y + FH * 0.69);
            const lw = pdf.getTextWidth(label) + 3;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10 * scale);
            pdf.setTextColor(0);
            const val = String(value || '');
            const maxValW = w - lw - 4;
            const truncated = pdf.getTextWidth(val) > maxValW
                ? pdf.splitTextToSize(val, maxValW)[0]
                : val;
            pdf.text(truncated, x + 2 + lw, y + FH * 0.69);
            pdf.setDrawColor(210); pdf.setLineWidth(0.15);
            pdf.line(x, y + FH, x + w, y + FH);
            if (!opts.noAdvance) y += FH;
        }

        function row2(lbl1, val1, lbl2, val2) {
            const ry = y;
            row(lbl1, val1, marginX, halfW, { noAdvance: true });
            row(lbl2, val2, halfX,   halfW, { noAdvance: true });
            pdf.setDrawColor(210); pdf.setLineWidth(0.2);
            pdf.line(halfX, ry, halfX, ry + FH);
            y += FH;
        }

        function stackedRow(label, value, x, w) {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8 * scale);
            pdf.setTextColor(70);
            pdf.text(label, x + 2, y + FH * 0.69);
            pdf.setDrawColor(210); pdf.setLineWidth(0.15);
            pdf.line(x, y + FH, x + w, y + FH);
            y += FH;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10 * scale);
            pdf.setTextColor(0);
            const lines = pdf.splitTextToSize(String(value || ''), w - 4);
            if (lines.length === 0) {
                pdf.line(x, y + FH, x + w, y + FH);
                y += FH;
            } else {
                lines.forEach(ln => {
                    pdf.text(ln, x + 2, y + FH * 0.69);
                    pdf.setDrawColor(210); pdf.setLineWidth(0.15);
                    pdf.line(x, y + FH, x + w, y + FH);
                    y += FH;
                });
            }
        }

        // ── TITLE ────────────────────────────────────────────────────────────
        pdf.setFillColor(28, 38, 75);
        pdf.rect(marginX, y, contentW, titleH, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13 * scale);
        pdf.setTextColor(255, 255, 255);
        pdf.text('Registration of Beneficiary', pageW / 2, y + titleH * 0.68, { align: 'center' });
        pdf.setTextColor(0);
        y += titleH;

        // ── PHOTO + FIRST FIELDS ─────────────────────────────────────────────
        pdf.setDrawColor(100); pdf.setLineWidth(0.4);
        pdf.rect(photoX, y, photoW, photoH);
        if (photoData) {
            try {
                const fmt = /^data:image\/(png)/i.test(photoData) ? 'PNG' : 'JPEG';
                pdf.addImage(photoData, fmt, photoX + 1, y + 1, photoW - 2, photoH - 2);
            } catch (e) { /* skip on format error */ }
        } else {
            pdf.setFontSize(7 * scale); pdf.setTextColor(150);
            pdf.text('PHOTO', photoX + photoW / 2, y + photoH / 2 + 1, { align: 'center' });
            pdf.setTextColor(0);
        }
        pdf.setDrawColor(200); pdf.setLineWidth(0.2);
        pdf.line(photoX, y, photoX, y + photoH);

        row('Name:',                      d.beneficiary_name, marginX, nameW);
        row('Father / Mother / Husband:', d.guardian_name,    marginX, nameW);

        const halfNameX = marginX + nameW / 2;
        const halfNameW = nameW / 2;
        const nameRowY  = y;
        row('Age:',    d.age,    marginX,   halfNameW, { noAdvance: true });
        row('Gender:', d.gender, halfNameX, halfNameW, { noAdvance: true });
        pdf.setDrawColor(210); pdf.setLineWidth(0.2);
        pdf.line(halfNameX, nameRowY, halfNameX, nameRowY + FH);
        y += FH;

        row('Qualification:', d.education, marginX, nameW);

        // ── PERSONAL INFORMATION ─────────────────────────────────────────────
        sectionBar('PERSONAL INFORMATION');
        row2('Marital Status:', d.marital_status, 'No. of Children:', d.children_count);
        row('Personal Identification Mark:', d.id_mark, marginX, contentW);

        // ── LOCATION & EMPLOYMENT ────────────────────────────────────────────
        sectionBar('LOCATION & EMPLOYMENT');
        stackedRow('Location / Whereabouts:',         d.location,        marginX, contentW);
        stackedRow('Native Place Address:',           d.native_place,     marginX, contentW);
        stackedRow('Occupation / Activity:',          d.occupation_id,    marginX, contentW);
        row(        'Place of Occupation / Activity:', d.occupation_place, marginX, contentW);

        // ── CONTACT & REFERENCES ─────────────────────────────────────────────
        sectionBar('CONTACT & REFERENCES');
        row('Reference Person Name:', d.reference_name,    marginX, contentW);
        row('Reference Address:',     d.reference_address, marginX, contentW);
        row('Contact Number:',        d.contact_no,        marginX, contentW);

        // ── HEALTH & STAY ────────────────────────────────────────────────────
        sectionBar('HEALTH & STAY');
        row2('Health Status:', d.health_status, 'Habits:', d.habits);
        row2('Reason for Stay in the ULB:', d.reason_ulb, 'Stay Type:', d.stay_type);
        stackedRow('Remarks / Special Attention:', d.remarks, marginX, contentW);

        // ── SIGNATURES ───────────────────────────────────────────────────────
        const sigH = FH * 6;
        pdf.setFillColor(248, 248, 248);
        pdf.rect(marginX, y, contentW, sigH, 'F');
        pdf.setDrawColor(200); pdf.setLineWidth(0.2);
        pdf.line(halfX, y, halfX, y + sigH);
        pdf.line(marginX, y + sigH, marginX + contentW, y + sigH);
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5 * scale); pdf.setTextColor(60);
        pdf.text('Signature / Thumb Impression', marginX + 3, y + FH * 0.75);
        pdf.text('Signature of the Surveyor',    halfX + 3,   y + FH * 0.75);
        pdf.setTextColor(0);
        y += sigH;

        // ── OFFICE USE ONLY ──────────────────────────────────────────────────
        sectionBar('OFFICE USE ONLY');
        row2('Name of the Shelter:', d.shelter,    'Location:',  d.shelterLoc);
        row2('Name of the ULB:',     d.ulb,        'Ward No:',   d.ward);
        row('Shelter Management Agency Name:', d.agency, marginX, contentW);

        // Outer border
        pdf.setDrawColor(0); pdf.setLineWidth(0.5);
        pdf.rect(marginX, marginY, contentW, y - marginY);

        return y; // total content end position
    }

    // Pass 1 — measure with scale=1.0 using a throwaway PDF instance
    const measurePdf = new jsPDF('p', 'mm', 'a4');
    const measuredEnd = buildLayout(measurePdf, 1.0);
    const measuredH   = measuredEnd - marginY;

    // Pass 2 — scale to fit (floor at 0.65 to keep text readable), then render for real
    const scale   = Math.max(0.65, Math.min(1.0, availableH / measuredH));
    const realPdf = new jsPDF('p', 'mm', 'a4');
    buildLayout(realPdf, scale);
    realPdf.save('beneficiary_form.pdf');
}
