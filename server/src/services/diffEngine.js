import pool from '../db/pool.js';

// Load current state of all entities from DB into memory
// so we can do fast lookups during diff without hitting DB per row
async function loadCurrentState() {
    const [orgs, terms, users, classes, enrollments] = await Promise.all([
        pool.query('SELECT * FROM orgs'),
        pool.query('SELECT * FROM terms'),
        pool.query('SELECT * FROM users'),
        pool.query('SELECT * FROM classes'),
        pool.query('SELECT * FROM enrollments'),
    ]);

    // Key everything by sourced_id for O(1) lookups
    return {
        orgs: Object.fromEntries(orgs.rows.map(r => [r.sourced_id, r])),
        terms: Object.fromEntries(terms.rows.map(r => [r.sourced_id, r])),
        users: Object.fromEntries(users.rows.map(r => [r.sourced_id, r])),
        classes: Object.fromEntries(classes.rows.map(r => [r.sourced_id, r])),
        enrollments: Object.fromEntries(enrollments.rows.map(r => [r.sourced_id, r])),
        // also index users by email to catch duplicate email conflicts
        usersByEmail: Object.fromEntries(users.rows.map(r => [r.email, r])),
    };
}

// --- per-entity diff functions ---

function diffOrgs(incoming, current) {
    const items = [];

    for (const row of incoming) {
        const existing = current.orgs[row.sourcedId];

        if (row.status === 'tobedeleted') {
            if (existing) items.push({ entityType: 'org', sourcedId: row.sourcedId, changeType: 'remove', incomingData: row, currentData: existing });
            continue;
        }

        if (!existing) {
            items.push({ entityType: 'org', sourcedId: row.sourcedId, changeType: 'add', incomingData: row, currentData: null });
            continue;
        }

        // check if anything actually changed
        if (existing.name !== row.name || existing.type !== row.type) {
            items.push({ entityType: 'org', sourcedId: row.sourcedId, changeType: 'update', incomingData: row, currentData: existing });
        }
    }

    return items;
}

function diffTerms(incoming, current) {
    const items = [];

    for (const row of incoming) {
        const existing = current.terms[row.sourcedId];

        if (row.status === 'tobedeleted') {
            if (existing) items.push({ entityType: 'term', sourcedId: row.sourcedId, changeType: 'remove', incomingData: row, currentData: existing });
            continue;
        }

        // term references an org that doesn't exist in our DB
        if (!current.orgs[row.orgSourcedId]) {
            items.push({ entityType: 'term', sourcedId: row.sourcedId, changeType: 'conflict', conflictType: 'missing_org', incomingData: row, currentData: existing ?? null });
            continue;
        }

        if (!existing) {
            items.push({ entityType: 'term', sourcedId: row.sourcedId, changeType: 'add', incomingData: row, currentData: null });
            continue;
        }

        if (existing.name !== row.name || existing.start_date?.toISOString().slice(0, 10) !== row.startDate || existing.end_date?.toISOString().slice(0, 10) !== row.endDate) {
            items.push({ entityType: 'term', sourcedId: row.sourcedId, changeType: 'update', incomingData: row, currentData: existing });
        }
    }

    return items;
}

function diffUsers(incoming, current) {
    const items = [];

    for (const row of incoming) {
        const existing = current.users[row.sourcedId];

        if (row.status === 'tobedeleted') {
            if (existing) items.push({ entityType: 'user', sourcedId: row.sourcedId, changeType: 'remove', incomingData: row, currentData: existing });
            continue;
        }

        // catch duplicate email — same email exists but different sourced_id
        const emailOwner = current.usersByEmail[row.email];
        if (emailOwner && emailOwner.sourced_id !== row.sourcedId) {
            items.push({ entityType: 'user', sourcedId: row.sourcedId, changeType: 'conflict', conflictType: 'duplicate_email', incomingData: row, currentData: emailOwner });
            continue;
        }

        if (!current.orgs[row.orgSourcedId]) {
            items.push({ entityType: 'user', sourcedId: row.sourcedId, changeType: 'conflict', conflictType: 'missing_org', incomingData: row, currentData: existing ?? null });
            continue;
        }

        if (!existing) {
            items.push({ entityType: 'user', sourcedId: row.sourcedId, changeType: 'add', incomingData: row, currentData: null });
            continue;
        }

        if (
            existing.first_name !== row.givenName ||
            existing.last_name !== row.familyName ||
            existing.email !== row.email ||
            existing.role !== row.role
        ) {
            items.push({ entityType: 'user', sourcedId: row.sourcedId, changeType: 'update', incomingData: row, currentData: existing });
        }
    }

    return items;
}

function diffClasses(incoming, current) {
    const items = [];

    for (const row of incoming) {
        const existing = current.classes[row.sourcedId];

        if (row.status === 'tobedeleted') {
            if (existing) items.push({ entityType: 'class', sourcedId: row.sourcedId, changeType: 'remove', incomingData: row, currentData: existing });
            continue;
        }

        if (!current.orgs[row.orgSourcedId]) {
            items.push({ entityType: 'class', sourcedId: row.sourcedId, changeType: 'conflict', conflictType: 'missing_org', incomingData: row, currentData: existing ?? null });
            continue;
        }

        // class references a term that doesn't exist
        if (!current.terms[row.termSourcedId]) {
            items.push({ entityType: 'class', sourcedId: row.sourcedId, changeType: 'conflict', conflictType: 'term_mismatch', incomingData: row, currentData: existing ?? null });
            continue;
        }

        if (!existing) {
            items.push({ entityType: 'class', sourcedId: row.sourcedId, changeType: 'add', incomingData: row, currentData: null });
            continue;
        }

        if (existing.title !== row.title) {
            items.push({ entityType: 'class', sourcedId: row.sourcedId, changeType: 'update', incomingData: row, currentData: existing });
        }
    }

    return items;
}

function diffEnrollments(incoming, current) {
    const items = [];

    for (const row of incoming) {
        const existing = current.enrollments[row.sourcedId];

        // enrollment for a user that's being deleted in this same sync
        if (row.status === 'tobedeleted') {
            if (existing) items.push({ entityType: 'enrollment', sourcedId: row.sourcedId, changeType: 'remove', incomingData: row, currentData: existing });
            continue;
        }

        const userExists = current.users[row.userSourcedId];
        const classExists = current.classes[row.classSourcedId];

        if (!userExists || !classExists) {
            items.push({ entityType: 'enrollment', sourcedId: row.sourcedId, changeType: 'conflict', conflictType: 'inactive_enrollment', incomingData: row, currentData: existing ?? null });
            continue;
        }

        if (!existing) {
            items.push({ entityType: 'enrollment', sourcedId: row.sourcedId, changeType: 'add', incomingData: row, currentData: null });
            continue;
        }

        if (existing.role !== row.role) {
            items.push({ entityType: 'enrollment', sourcedId: row.sourcedId, changeType: 'update', incomingData: row, currentData: existing });
        }
    }

    return items;
}

// Main export — runs all diffs and returns a flat list of change items
export async function computeDiff(bundle) {
    const current = await loadCurrentState();

    const items = [
        ...diffOrgs(bundle.orgs, current),
        ...diffTerms(bundle.terms, current),
        ...diffUsers(bundle.users, current),
        ...diffClasses(bundle.classes, current),
        ...diffEnrollments(bundle.enrollments, current),
    ];

    // summary stats to store on the sync_run record
    const stats = {
        adds: items.filter(i => i.changeType === 'add').length,
        updates: items.filter(i => i.changeType === 'update').length,
        removes: items.filter(i => i.changeType === 'remove').length,
        conflicts: items.filter(i => i.changeType === 'conflict').length,
        total: items.length,
    };

    return { items, stats };
}