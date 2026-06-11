import pool from '../db/pool.js';

// take a snapshot of a row before we change it so we can restore it on rollback
async function snapshot(client, syncRunId, entityType, entityId, data) {
    await client.query(`
        INSERT INTO sync_snapshots (sync_run_id, entity_type, entity_id, snapshot_data)
        VALUES ($1, $2, $3, $4)
    `, [syncRunId, entityType, entityId, JSON.stringify(data)]);
}

// map OneRoster CSV field names to our DB column names
function mapUser(incoming) {
    return {
        first_name: incoming.givenName,
        last_name: incoming.familyName,
        email: incoming.email,
        role: incoming.role,
        sourced_id: incoming.sourcedId,
        status: incoming.status === 'tobedeleted' ? 'inactive' : 'active',
    };
}

function mapClass(incoming) {
    return {
        title: incoming.title,
        sourced_id: incoming.sourcedId,
        status: incoming.status === 'tobedeleted' ? 'inactive' : 'active',
    };
}

function mapOrg(incoming) {
    return {
        name: incoming.name,
        type: incoming.type,
        sourced_id: incoming.sourcedId,
        status: incoming.status === 'tobedeleted' ? 'inactive' : 'active',
    };
}

function mapTerm(incoming) {
    return {
        name: incoming.name,
        start_date: incoming.startDate,
        end_date: incoming.endDate,
        sourced_id: incoming.sourcedId,
        status: incoming.status === 'tobedeleted' ? 'inactive' : 'active',
    };
}

// apply a single sync_run_item to the DB
async function applyItem(client, item, syncRunId) {
    const incoming = item.incoming_data;
    const current = item.current_data;
    const type = item.entity_type;
    const changeType = item.change_type;

    if (changeType === 'conflict' && item.resolution === 'skip') return;

    if (changeType === 'conflict' && !item.resolution) return;

    if (type === 'user') {
        const mapped = mapUser(incoming);

        if (changeType === 'add' || (changeType === 'conflict' && item.resolution === 'override')) {
            const org = await client.query(`SELECT id FROM orgs WHERE sourced_id = $1`, [incoming.orgSourcedId]);
            const orgId = org.rows[0]?.id ?? null;

            await client.query(`
                INSERT INTO users (sourced_id, first_name, last_name, email, role, org_id, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (sourced_id) DO UPDATE SET
                    first_name = EXCLUDED.first_name,
                    last_name  = EXCLUDED.last_name,
                    email      = EXCLUDED.email,
                    role       = EXCLUDED.role,
                    status     = EXCLUDED.status
            `, [mapped.sourced_id, mapped.first_name, mapped.last_name, mapped.email, mapped.role, orgId, mapped.status]);
        }

        if (changeType === 'update') {
            // snapshot before updating
            await snapshot(client, syncRunId, 'user', current.id, current);

            await client.query(`
                UPDATE users SET
                    first_name = $1, last_name = $2, email = $3, role = $4, status = $5
                WHERE sourced_id = $6
            `, [mapped.first_name, mapped.last_name, mapped.email, mapped.role, mapped.status, mapped.sourced_id]);
        }

        if (changeType === 'remove') {
            await snapshot(client, syncRunId, 'user', current.id, current);
            await client.query(`UPDATE users SET status = 'inactive' WHERE sourced_id = $1`, [incoming.sourcedId]);
        }
    }

    if (type === 'org') {
        const mapped = mapOrg(incoming);

        if (changeType === 'add') {
            const parent = await client.query(`SELECT id FROM orgs WHERE sourced_id = $1`, [incoming.parentSourcedId]);
            const parentId = parent.rows[0]?.id ?? null;

            await client.query(`
                INSERT INTO orgs (sourced_id, name, type, parent_org_id, status)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (sourced_id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type
            `, [mapped.sourced_id, mapped.name, mapped.type, parentId, mapped.status]);
        }

        if (changeType === 'update') {
            await snapshot(client, syncRunId, 'org', current.id, current);
            await client.query(`
                UPDATE orgs SET name = $1, type = $2, status = $3 WHERE sourced_id = $4
            `, [mapped.name, mapped.type, mapped.status, mapped.sourced_id]);
        }

        if (changeType === 'remove') {
            await snapshot(client, syncRunId, 'org', current.id, current);
            await client.query(`UPDATE orgs SET status = 'inactive' WHERE sourced_id = $1`, [incoming.sourcedId]);
        }
    }

    if (type === 'term') {
        const mapped = mapTerm(incoming);

        if (changeType === 'add') {
            const org = await client.query(`SELECT id FROM orgs WHERE sourced_id = $1`, [incoming.orgSourcedId]);
            const orgId = org.rows[0]?.id ?? null;

            await client.query(`
                INSERT INTO terms (sourced_id, name, start_date, end_date, org_id, status)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (sourced_id) DO UPDATE SET name = EXCLUDED.name
            `, [mapped.sourced_id, mapped.name, mapped.start_date, mapped.end_date, orgId, mapped.status]);
        }

        if (changeType === 'update') {
            await snapshot(client, syncRunId, 'term', current.id, current);
            await client.query(`
                UPDATE terms SET name = $1, start_date = $2, end_date = $3, status = $4 WHERE sourced_id = $5
            `, [mapped.name, mapped.start_date, mapped.end_date, mapped.status, mapped.sourced_id]);
        }

        if (changeType === 'remove') {
            await snapshot(client, syncRunId, 'term', current.id, current);
            await client.query(`UPDATE terms SET status = 'inactive' WHERE sourced_id = $1`, [incoming.sourcedId]);
        }
    }

    if (type === 'class') {
        const mapped = mapClass(incoming);

        if (changeType === 'add') {
            const org = await client.query(`SELECT id FROM orgs WHERE sourced_id = $1`, [incoming.orgSourcedId]);
            const term = await client.query(`SELECT id FROM terms WHERE sourced_id = $1`, [incoming.termSourcedId]);
            const orgId = org.rows[0]?.id ?? null;
            const termId = term.rows[0]?.id ?? null;

            await client.query(`
                INSERT INTO classes (sourced_id, title, org_id, term_id, status)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (sourced_id) DO UPDATE SET title = EXCLUDED.title
            `, [mapped.sourced_id, mapped.title, orgId, termId, mapped.status]);
        }

        if (changeType === 'update') {
            await snapshot(client, syncRunId, 'class', current.id, current);
            await client.query(`
                UPDATE classes SET title = $1, status = $2 WHERE sourced_id = $3
            `, [mapped.title, mapped.status, mapped.sourced_id]);
        }

        if (changeType === 'remove') {
            await snapshot(client, syncRunId, 'class', current.id, current);
            await client.query(`UPDATE classes SET status = 'inactive' WHERE sourced_id = $1`, [incoming.sourcedId]);
        }
    }

    if (type === 'enrollment') {
        if (changeType === 'add') {
            const user = await client.query(`SELECT id FROM users WHERE sourced_id = $1`, [incoming.userSourcedId]);
            const cls = await client.query(`SELECT id FROM classes WHERE sourced_id = $1`, [incoming.classSourcedId]);
            const userId = user.rows[0]?.id ?? null;
            const classId = cls.rows[0]?.id ?? null;

            await client.query(`
                INSERT INTO enrollments (sourced_id, user_id, class_id, role, status)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (sourced_id) DO UPDATE SET role = EXCLUDED.role
            `, [incoming.sourcedId, userId, classId, incoming.role, 'active']);
        }

        if (changeType === 'update') {
            await snapshot(client, syncRunId, 'enrollment', current.id, current);
            await client.query(`
                UPDATE enrollments SET role = $1 WHERE sourced_id = $2
            `, [incoming.role, incoming.sourcedId]);
        }

        if (changeType === 'remove') {
            await snapshot(client, syncRunId, 'enrollment', current.id, current);
            await client.query(`UPDATE enrollments SET status = 'inactive' WHERE sourced_id = $1`, [incoming.sourcedId]);
        }
    }

    // mark this item as applied
    await client.query(`
        UPDATE sync_run_items SET status = 'applied' WHERE id = $1
    `, [item.id]);
}

export async function applySync(syncRunId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // fetch all pending/resolved items for this run
        const itemsResult = await client.query(`
            SELECT * FROM sync_run_items
            WHERE sync_run_id = $1 AND status IN ('pending', 'resolved')
            ORDER BY entity_type
        `, [syncRunId]);

        // apply in order: orgs → terms → users → classes → enrollments
        // because later entities depend on earlier ones
        const order = ['org', 'term', 'user', 'class', 'enrollment'];
        const sorted = itemsResult.rows.sort((a, b) =>
            order.indexOf(a.entity_type) - order.indexOf(b.entity_type)
        );

        for (const item of sorted) {
            await applyItem(client, item, syncRunId);
        }

        // mark the sync run as applied
        await client.query(`
            UPDATE sync_runs SET status = 'applied', applied_at = now() WHERE id = $1
        `, [syncRunId]);

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        await pool.query(`
            UPDATE sync_runs SET status = 'failed', error_details = $1 WHERE id = $2
        `, [JSON.stringify({ message: err.message }), syncRunId]);
        throw err;
    } finally {
        client.release();
    }
}

export async function rollbackSync(syncRunId) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // fetch all snapshots for this run
        const snapshots = await client.query(`
            SELECT * FROM sync_snapshots WHERE sync_run_id = $1
        `, [syncRunId]);

        // restore each entity to its pre-sync state
        for (const snap of snapshots.rows) {
            const data = snap.snapshot_data;
            const table = snap.entity_type === 'class' ? 'classes' : `${snap.entity_type}s`;

            if (snap.entity_type === 'user') {
                await client.query(`
        UPDATE users SET email = concat('_rollback_', id, '@placeholder.invalid')
        WHERE email = $1 AND id != $2
    `, [data.email, snap.entity_id]);

                await client.query(`
        UPDATE users SET
            first_name = $1, last_name = $2, email = $3,
            role = $4, status = $5
        WHERE id = $6
    `, [data.first_name, data.last_name, data.email, data.role, data.status, snap.entity_id]);
            }

            if (snap.entity_type === 'org') {
                await client.query(`
                    UPDATE orgs SET name = $1, type = $2, status = $3 WHERE id = $4
                `, [data.name, data.type, data.status, snap.entity_id]);
            }

            if (snap.entity_type === 'term') {
                await client.query(`
                    UPDATE terms SET name = $1, start_date = $2, end_date = $3, status = $4 WHERE id = $5
                `, [data.name, data.start_date, data.end_date, data.status, snap.entity_id]);
            }

            if (snap.entity_type === 'class') {
                await client.query(`
                    UPDATE classes SET title = $1, status = $2 WHERE id = $3
                `, [data.title, data.status, snap.entity_id]);
            }

            if (snap.entity_type === 'enrollment') {
                await client.query(`
                    UPDATE enrollments SET role = $1, status = $2 WHERE id = $3
                `, [data.role, data.status, snap.entity_id]);
            }
        }

        // mark the sync run as rolled back
        await client.query(`
            UPDATE sync_runs SET status = 'rolled_back', rolled_back_at = now() WHERE id = $1
        `, [syncRunId]);

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}