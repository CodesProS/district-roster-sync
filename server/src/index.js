import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import syncRouter from './routes/sync.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/sync', syncRouter)

app.get('/api/ping', (req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})