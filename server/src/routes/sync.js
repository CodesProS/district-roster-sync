import express from 'express'
import multer from 'multer'
import db from '../db/pool.js'
import { parseBundle } from '../services/csvParser.js'
import { computeDiff } from '../services/diffEngine.js'
import { applySync, rollbackSync } from '../services/applySync.js'


const syncRouter = express.Router()
const upload = multer({
    storage: multer.memoryStorage(),
})

// upload.fields() tells multer which file fields to expect
/* Example of data:
req.files = {
  users:       [{ buffer: <raw bytes>, originalname: 'users.csv', ... }],
  classes:     [{ buffer: <raw bytes>, originalname: 'classes.csv', ... }],
  enrollments: [{ buffer: <raw bytes>, ... }],
}*/
syncRouter.post('/upload', upload.fields([
    { name: 'orgs' },
    { name: 'users' },
    { name: 'classes' },
    { name: 'enrollments' },
    { name: 'terms' },
]), async (req, res) => {
    try {
        const buffers = Object.fromEntries(
            Object.entries(req.files).map(([key, fileArr]) => [key, fileArr[0].buffer])
        )

        const files = parseBundle(buffers)
        const { items, stats } = await computeDiff(files)

        const result = await db.query(`
        INSERT INTO sync_runs(actor, status, stats)
        VALUES($1, $2, $3) RETURNING id`, ['district_admin', 'previewed', JSON.stringify(stats)])

        const runId = result.rows[0].id

        if (items.length > 0) {
            const values = items.map((item, i) => {
                const b = i * 7
                return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`
            }).join(', ')

            const params = items.flatMap(item => [
                runId,
                item.entityType,
                item.sourcedId,
                item.changeType,
                item.conflictType ?? null,
                JSON.stringify(item.incomingData),
                item.currentData ? JSON.stringify(item.currentData) : null,
            ])

            await db.query(`
    INSERT INTO sync_run_items
      (sync_run_id, entity_type, sourced_id, change_type, conflict_type, incoming_data, current_data)
    VALUES ${values}
  `, params)
        }
        res.status(201).json({ syncRunId: runId, stats })
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: error.message })
    }

})

// returns all sync runs for the history screen, newest first
syncRouter.get('/runs', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM sync_runs ORDER BY created_at DESC
        `)
        res.json(result.rows)
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: error.message })
    }
})

syncRouter.get('/:id/preview', async (req, res) => {
    try {
        const id = req.params.id;
        const sync_row_results = await db.query(`SELECT status, stats FROM sync_runs WHERE id = $1`, [id])
        const sync_items = await db.query(`SELECT * FROM sync_run_items WHERE sync_run_id = $1`, [id])
        const adds = sync_items.rows.filter(r => r.change_type === 'add')
        const updates = sync_items.rows.filter(r => r.change_type === 'update')
        const removes = sync_items.rows.filter(r => r.change_type === 'remove')
        const conflicts = sync_items.rows.filter(r => r.change_type === 'conflict')

        const merged = { adds, updates, removes, conflicts }
        res.status(200).json({
            sync_run: sync_row_results.rows[0],
            stats: sync_row_results.rows[0].stats,
            items: merged
        })
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: error.message })
    }
})

syncRouter.post('/:id/resolve', async (req, res) => {
    try {
        const { id } = req.params
        const { resolutions } = req.body

        if (!Array.isArray(resolutions) || resolutions.length === 0) {
            return res.status(400).json({ error: 'No resolutions provided' })
        }

        for (const { itemId, resolution, resolutionMeta } of resolutions) {
            await db.query(`
                UPDATE sync_run_items
                SET resolution = $1, resolution_meta = $2, status = 'resolved'
                WHERE id = $3 AND sync_run_id = $4
            `, [resolution, resolutionMeta ? JSON.stringify(resolutionMeta) : null, itemId, id])
        }

        res.json({ ok: true })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: error.message })
    }
})

syncRouter.post('/:id/apply', async (req, res) => {
    try {
        await applySync(req.params.id)
        res.json({ ok: true })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: err.message })
    }
})

syncRouter.post('/:id/rollback', async (req, res) => {
    try {
        await rollbackSync(req.params.id)
        res.json({ ok: true })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: err.message })
    }
})



export default syncRouter

