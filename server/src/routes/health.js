import express from 'express'
import db from '../db/pool.js'

const healthRouter = express.Router()

// GET /api/health
// returns data health indicators for the district
healthRouter.get('/', async (req, res) => {
    try {
        // students with no active enrollment
        const orphanedStudents = await db.query(`
            SELECT u.id, u.sourced_id, u.first_name, u.last_name, u.email
            FROM users u
            WHERE u.role = 'student'
            AND u.status = 'active'
            AND NOT EXISTS (
                SELECT 1 FROM enrollments e
                WHERE e.user_id = u.id AND e.status = 'active'
            )
        `)

        // classes with no teacher enrolled
        const classesWithoutTeacher = await db.query(`
            SELECT c.id, c.sourced_id, c.title
            FROM classes c
            WHERE c.status = 'active'
            AND NOT EXISTS (
                SELECT 1 FROM enrollments e
                WHERE e.class_id = c.id
                AND e.role = 'teacher'
                AND e.status = 'active'
            )
        `)

        // enrollments referencing inactive or missing users
        const staleEnrollments = await db.query(`
            SELECT e.id, e.sourced_id, e.role,
                   u.first_name, u.last_name, u.email,
                   c.title as class_title
            FROM enrollments e
            JOIN users u ON u.id = e.user_id
            JOIN classes c ON c.id = e.class_id
            WHERE e.status = 'active'
            AND (u.status = 'inactive' OR c.status = 'inactive')
        `)

        // classes referencing a term that doesn't exist or is inactive
        const unmappedClasses = await db.query(`
            SELECT c.id, c.sourced_id, c.title, t.name as term_name, t.status as term_status
            FROM classes c
            JOIN terms t ON t.id = c.term_id
            WHERE c.status = 'active'
            AND t.status = 'inactive'
        `)

        res.json({
            orphanedStudents: orphanedStudents.rows,
            classesWithoutTeacher: classesWithoutTeacher.rows,
            staleEnrollments: staleEnrollments.rows,
            unmappedClasses: unmappedClasses.rows,
            summary: {
                orphanedStudents: orphanedStudents.rows.length,
                classesWithoutTeacher: classesWithoutTeacher.rows.length,
                staleEnrollments: staleEnrollments.rows.length,
                unmappedClasses: unmappedClasses.rows.length,
            }
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: err.message })
    }
})

export default healthRouter