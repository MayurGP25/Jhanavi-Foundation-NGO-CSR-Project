/**
 * Shared beneficiary form validation.
 * Used by both the registration (add) and edit forms.
 *
 * Each entry in `fields` describes one input:
 *   - id        {string}   The element's id attribute
 *   - type      {string}   Optional. 'file' | 'occupation' for special handling.
 *   - required  {boolean}  Default true. Set false to skip the empty check.
 *   - min       {number}   Optional. Minimum numeric value (checked when non-empty).
 *   - max       {number}   Optional. Maximum numeric value (checked when non-empty).
 *
 * On failure the function:
 *   1. Adds the Bootstrap `is-invalid` class to the relevant control/wrapper.
 *   2. Shows the matching `<span id="{id}-error" class="error-message">` element.
 *   3. Smooth-scrolls and focuses the first invalid field.
 *
 * @param {Array<{id: string, type?: string, required?: boolean, min?: number, max?: number}>} fields
 * @returns {boolean} true if every field passes; false if any field fails
 */
function validateBeneficiaryForm(fields) {
    document.querySelectorAll('.error-message').forEach(m => m.classList.remove('show'));

    let isValid = true;
    let firstInvalid = null;

    fields.forEach(field => {
        const el  = document.getElementById(field.id);
        const err = document.getElementById(`${field.id}-error`);
        const isRequired = field.required !== false;

        const rawVal = field.type === 'file' ? null : (el?.value?.trim() ?? '');
        const isEmpty = field.type === 'file'
            ? !el?.files?.length
            : !rawVal;

        const toggle = field.type === 'occupation'
            ? document.getElementById('occupationToggle')
            : field.id === 'photoInput'
                ? document.querySelector('.photo-upload-container')
                : el;

        let fieldInvalid = false;

        if (isRequired && isEmpty) {
            fieldInvalid = true;
            if (err) err.textContent = err.dataset.requiredMsg || err.textContent;
        } else if (!isEmpty && (field.min !== undefined || field.max !== undefined)) {
            const numVal = parseFloat(rawVal);
            if (numVal < field.min || numVal > field.max) {
                fieldInvalid = true;
                if (err) err.textContent = `Must be between ${field.min} and ${field.max}`;
            }
        }

        if (fieldInvalid) {
            isValid = false;
            toggle?.classList.add('is-invalid');
            if (err) err.classList.add('show');
            if (!firstInvalid) firstInvalid = el;
        } else {
            toggle?.classList.remove('is-invalid');
            if (err) err.classList.remove('show');
        }
    });

    if (!isValid && firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => firstInvalid.focus(), 500);
    }

    return isValid;
}
