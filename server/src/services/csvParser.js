import { parse } from 'csv-parse/sync';

// OneRoster column names for each entity type
// These match what a real SIS exports — districts don't get to rename these
const REQUIRED_FIELDS = {
    orgs: ['sourcedId', 'name', 'type', 'status'],
    users: ['sourcedId', 'givenName', 'familyName', 'email', 'role', 'orgSourcedId', 'status'],
    classes: ['sourcedId', 'title', 'orgSourcedId', 'termSourcedId', 'status'],
    enrollments: ['sourcedId', 'classSourcedId', 'userSourcedId', 'role', 'status'],
    terms: ['sourcedId', 'name', 'orgSourcedId', 'startDate', 'endDate', 'status'],
};

function parseCSV(buffer) {
    return parse(buffer, {
        columns: true,        // use first row as column names
        skip_empty_lines: true,
        trim: true,           // strip accidental whitespace from values
    });
}

// Make sure the CSV has all the columns we need before doing anything with it
function validateFields(rows, entityType) {
    const required = REQUIRED_FIELDS[entityType];
    if (!required) throw new Error(`Unknown entity type: ${entityType}`);

    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

    const missing = required.filter(field => !headers.includes(field));
    return missing.map(field => `Missing required column: ${field}`);
}

// Main entry point — takes a map of { entityType: fileBuffer } and returns
// parsed rows grouped by entity, plus any errors that came up per file
export function parseBundle(files) {
    const result = {
        orgs: [],
        users: [],
        classes: [],
        enrollments: [],
        terms: [],
        errors: [],
    };

    for (const [entityType, buffer] of Object.entries(files)) {
        if (!buffer) continue;

        try {
            const rows = parseCSV(buffer);

            const fieldErrors = validateFields(rows, entityType);
            if (fieldErrors.length > 0) {
                result.errors.push({ entityType, errors: fieldErrors });
                continue;
            }

            result[entityType] = rows;
        } catch (err) {
            result.errors.push({ entityType, errors: [`Failed to parse ${entityType}: ${err.message}`] });
        }
    }

    return result;
}