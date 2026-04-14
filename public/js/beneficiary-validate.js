/**
 * Shared beneficiary form validation.
 * Used by both the registration (add) and edit forms.
 *
 * Each entry in `fields` describes one required input:
 *   - id       {string}  The element's id attribute
 *   - type     {string}  Optional. 'file' checks file input; 'occupation'
 *                        highlights the occupationToggle wrapper instead of
 *                        the hidden input itself.  Omit for plain text inputs.
 *
 * On failure the function:
 *   1. Adds the Bootstrap `is-invalid` class to the relevant control/wrapper.
 *   2. Shows the matching `<span id="{id}-error" class="error-message">` element.
 *   3. Smooth-scrolls and focuses the first invalid field.
 *
 * @param {Array<{id: string, type?: string}>} fields - list of required fields
 * @returns {boolean} true if every field passes; false if any field is empty
 */
function validateBeneficiaryForm(fields) {
    // Clear all previous error states before re-validating
    document.querySelectorAll('.error-message').forEach(m => m.classList.remove('show'));

    let isValid = true;
    let firstInvalid = null;

    fields.forEach(field => {
        const el  = document.getElementById(field.id);
        const err = document.getElementById(`${field.id}-error`);

        // Determine emptiness — file inputs need a files-length check
        const isEmpty = field.type === 'file'
            ? !el?.files?.length
            : !el?.value?.trim();

        // Resolve which DOM element receives the invalid highlight:
        //   occupation  → the toggle/dropdown wrapper
        //   photoInput  → the upload container (not the hidden <input>)
        //   everything else → the field element itself
        const toggle = field.type === 'occupation'
            ? document.getElementById('occupationToggle')
            : field.id === 'photoInput'
                ? document.querySelector('.photo-upload-container')
                : el;

        if (isEmpty) {
            isValid = false;
            toggle?.classList.add('is-invalid');
            if (err) err.classList.add('show');
            if (!firstInvalid) firstInvalid = el; // track first for scroll/focus
        } else {
            toggle?.classList.remove('is-invalid');
            if (err) err.classList.remove('show');
        }
    });

    // Bring the first invalid field into view and focus it
    if (!isValid && firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => firstInvalid.focus(), 500);
    }

    return isValid;
}
