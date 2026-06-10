import pool from './pool.js';

async function seed() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query('DELETE FROM enrollments');
        await client.query('DELETE FROM classes');
        await client.query('DELETE FROM users');
        await client.query('DELETE FROM terms');
        await client.query('DELETE FROM orgs');
        await client.query('DELETE FROM sync_snapshots');
        await client.query('DELETE FROM sync_run_items');
        await client.query('DELETE FROM sync_runs');

        await client.query(`
      INSERT INTO orgs (id, sourced_id, name, type, parent_org_id, status) VALUES
      ('a0000001-0000-0000-0000-000000000001', 'ORG-001', 'Madison USD',         'district', NULL,                                          'active'),
      ('a0000001-0000-0000-0000-000000000002', 'ORG-002', 'Lincoln High School', 'school',   'a0000001-0000-0000-0000-000000000001', 'active'),
      ('a0000001-0000-0000-0000-000000000003', 'ORG-003', 'Jefferson Middle',    'school',   'a0000001-0000-0000-0000-000000000001', 'active')
    `);

        await client.query(`
      INSERT INTO terms (id, sourced_id, name, start_date, end_date, org_id, status) VALUES
      ('b0000002-0000-0000-0000-000000000001', 'TERM-001', 'Fall 2026',   '2026-09-01', '2026-12-20', 'a0000001-0000-0000-0000-000000000001', 'active'),
      ('b0000002-0000-0000-0000-000000000002', 'TERM-002', 'Spring 2027', '2027-01-15', '2027-05-30', 'a0000001-0000-0000-0000-000000000001', 'active')
    `);

        await client.query(`
      INSERT INTO users (id, sourced_id, first_name, last_name, email, role, org_id, status) VALUES
      ('c0000003-0000-0000-0000-000000000001', 'USR-001', 'Sarah',  'Chen',   's.chen@lincoln.edu',    'teacher', 'a0000001-0000-0000-0000-000000000002', 'active'),
      ('c0000003-0000-0000-0000-000000000002', 'USR-002', 'Marcus', 'Webb',   'm.webb@lincoln.edu',    'teacher', 'a0000001-0000-0000-0000-000000000002', 'active'),
      ('c0000003-0000-0000-0000-000000000003', 'USR-003', 'James',  'Park',   'j.park@students.edu',   'student', 'a0000001-0000-0000-0000-000000000002', 'active'),
      ('c0000003-0000-0000-0000-000000000004', 'USR-004', 'Priya',  'Nair',   'p.nair@students.edu',   'student', 'a0000001-0000-0000-0000-000000000002', 'active'),
      ('c0000003-0000-0000-0000-000000000005', 'USR-005', 'Diego',  'Reyes',  'd.reyes@students.edu',  'student', 'a0000001-0000-0000-0000-000000000003', 'active'),
      ('c0000003-0000-0000-0000-000000000006', 'USR-006', 'Aisha',  'Okafor', 'a.okafor@students.edu', 'student', 'a0000001-0000-0000-0000-000000000003', 'active')
    `);

        await client.query(`
      INSERT INTO classes (id, sourced_id, title, org_id, term_id, status) VALUES
      ('d0000004-0000-0000-0000-000000000001', 'CLS-001', 'Biology 101',   'a0000001-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000001', 'active'),
      ('d0000004-0000-0000-0000-000000000002', 'CLS-002', 'Algebra II',    'a0000001-0000-0000-0000-000000000002', 'b0000002-0000-0000-0000-000000000001', 'active'),
      ('d0000004-0000-0000-0000-000000000003', 'CLS-003', 'Earth Science', 'a0000001-0000-0000-0000-000000000003', 'b0000002-0000-0000-0000-000000000001', 'active')
    `);

        await client.query(`
      INSERT INTO enrollments (id, sourced_id, user_id, class_id, role, status) VALUES
      ('e0000005-0000-0000-0000-000000000001', 'ENR-001', 'c0000003-0000-0000-0000-000000000001', 'd0000004-0000-0000-0000-000000000001', 'teacher', 'active'),
      ('e0000005-0000-0000-0000-000000000002', 'ENR-002', 'c0000003-0000-0000-0000-000000000002', 'd0000004-0000-0000-0000-000000000002', 'teacher', 'active'),
      ('e0000005-0000-0000-0000-000000000003', 'ENR-003', 'c0000003-0000-0000-0000-000000000003', 'd0000004-0000-0000-0000-000000000001', 'student', 'active'),
      ('e0000005-0000-0000-0000-000000000004', 'ENR-004', 'c0000003-0000-0000-0000-000000000004', 'd0000004-0000-0000-0000-000000000001', 'student', 'active'),
      ('e0000005-0000-0000-0000-000000000005', 'ENR-005', 'c0000003-0000-0000-0000-000000000003', 'd0000004-0000-0000-0000-000000000002', 'student', 'active'),
      ('e0000005-0000-0000-0000-000000000006', 'ENR-006', 'c0000003-0000-0000-0000-000000000005', 'd0000004-0000-0000-0000-000000000003', 'student', 'active'),
      ('e0000005-0000-0000-0000-000000000007', 'ENR-007', 'c0000003-0000-0000-0000-000000000006', 'd0000004-0000-0000-0000-000000000003', 'student', 'active')
    `);

        await client.query('COMMIT');
        console.log('Seed complete.');
        console.log('  3 orgs (1 district, 2 schools)');
        console.log('  2 terms');
        console.log('  6 users (2 teachers, 4 students)');
        console.log('  3 classes');
        console.log('  7 enrollments');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Seed failed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();