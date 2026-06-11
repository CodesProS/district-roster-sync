import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const STATUS_COLORS = {
    applied: { bg: '#f0fdf4', text: '#166534', border: '#86efac' },
    rolled_back: { bg: '#f5f3ff', text: '#5b21b6', border: '#c4b5fd' },
    failed: { bg: '#fff1f2', text: '#991b1b', border: '#fca5a5' },
    previewed: { bg: '#eff6ff', text: '#1e40af', border: '#93c5fd' },
    pending: { bg: '#fafafa', text: '#444', border: '#e5e5e5' },
}

export default function HistoryPage() {
    const [runs, setRuns] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        axios.get('/api/sync/runs')
            .then(res => setRuns(res.data))
            .finally(() => setLoading(false))
    }, [])

    async function handleRollback(id) {
        if (!confirm('Roll back this sync? This will restore all changed records to their previous state.')) return
        try {
            await axios.post(`/api/sync/${id}/rollback`)
            const res = await axios.get('/api/sync/runs')
            setRuns(res.data)
        } catch (err) {
            alert(err.response?.data?.error ?? 'Rollback failed')
        }
    }

    if (loading) return <div style={{ padding: 40, color: '#666' }}>Loading...</div>

    return (
        <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Sync History</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>All roster sync attempts for Madison USD</p>
                </div>
                <a href="/sync" style={{
                    background: '#1a1a1a', color: '#fff', borderRadius: 6,
                    padding: '8px 16px', fontSize: 13
                }}>
                    New sync
                </a>
            </div>

            {runs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>
                    No sync runs yet. Upload a CSV bundle to get started.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {runs.map(run => {
                        const colors = STATUS_COLORS[run.status] ?? STATUS_COLORS.pending
                        const stats = run.stats ?? {}
                        return (
                            <div key={run.id} style={{
                                background: '#fff', border: '1px solid #e5e5e5',
                                borderRadius: 8, padding: '16px 20px',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                        <span style={{
                                            background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
                                            borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500
                                        }}>
                                            {run.status}
                                        </span>
                                        <span style={{ fontSize: 12, color: '#888' }}>
                                            {new Date(run.created_at).toLocaleString()}
                                        </span>
                                        <span style={{ fontSize: 12, color: '#888' }}>by {run.actor}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#666' }}>
                                        {stats.adds > 0 && <span style={{ color: '#166534' }}>+{stats.adds} adds</span>}
                                        {stats.updates > 0 && <span style={{ color: '#1e40af' }}>~{stats.updates} updates</span>}
                                        {stats.removes > 0 && <span style={{ color: '#991b1b' }}>-{stats.removes} removes</span>}
                                        {stats.conflicts > 0 && <span style={{ color: '#92400e' }}>⚠ {stats.conflicts} conflicts</span>}
                                        {!stats.total && <span>No changes</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {run.status === 'previewed' && (
                                        <button
                                            onClick={() => navigate(`/sync/${run.id}`)}
                                            style={{
                                                padding: '6px 14px', fontSize: 12, borderRadius: 4,
                                                cursor: 'pointer', background: '#fff', border: '1px solid #ddd'
                                            }}
                                        >
                                            View preview
                                        </button>
                                    )}
                                    {run.status === 'applied' && (
                                        <button
                                            onClick={() => handleRollback(run.id)}
                                            style={{
                                                padding: '6px 14px', fontSize: 12, borderRadius: 4,
                                                cursor: 'pointer', background: '#fff', border: '1px solid #fca5a5', color: '#991b1b'
                                            }}
                                        >
                                            Rollback
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}