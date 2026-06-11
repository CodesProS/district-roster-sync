import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

const CHANGE_COLORS = {
    add: { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    update: { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
    remove: { bg: '#fff1f2', border: '#fca5a5', text: '#991b1b' },
    conflict: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
}

function StatCard({ label, count, type }) {
    const colors = CHANGE_COLORS[type]
    return (
        <div style={{
            background: colors.bg, border: `1px solid ${colors.border}`,
            borderRadius: 8, padding: '12px 20px', textAlign: 'center', minWidth: 100
        }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>{count}</div>
            <div style={{ fontSize: 12, color: colors.text, textTransform: 'capitalize' }}>{label}</div>
        </div>
    )
}

function ItemRow({ item }) {
    const colors = CHANGE_COLORS[item.change_type]
    return (
        <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
            <td style={{ padding: '10px 12px' }}>
                <span style={{
                    background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
                    borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500
                }}>
                    {item.change_type}
                </span>
            </td>
            <td style={{ padding: '10px 12px', color: '#666', fontSize: 12 }}>{item.entity_type}</td>
            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{item.sourced_id}</td>
            <td style={{ padding: '10px 12px', fontSize: 12, color: '#444' }}>
                {item.conflict_type && (
                    <span style={{ color: '#92400e', fontWeight: 500 }}>{item.conflict_type}</span>
                )}
                {item.change_type === 'update' && item.current_data && item.incoming_data && (
                    <span>
                        {Object.keys(item.incoming_data).find(k =>
                            item.incoming_data[k] !== item.current_data[k] &&
                            !['sourcedId', 'status', 'orgSourcedId', 'termSourcedId'].includes(k)
                        ) && (
                                <span>
                                    {(() => {
                                        const changedKey = Object.keys(item.incoming_data).find(k =>
                                            item.incoming_data[k] !== item.current_data[k] &&
                                            !['sourcedId', 'status', 'orgSourcedId', 'termSourcedId'].includes(k)
                                        )
                                        return changedKey
                                            ? `${changedKey}: ${item.current_data[changedKey] ?? '—'} → ${item.incoming_data[changedKey]}`
                                            : null
                                    })()}
                                </span>
                            )}
                    </span>
                )}
            </td>
        </tr>
    )
}

export default function PreviewPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [applying, setApplying] = useState(false)

    useEffect(() => {
        axios.get(`/api/sync/${id}/preview`)
            .then(res => setData(res.data))
            .catch(err => setError(err.response?.data?.error ?? 'Failed to load preview'))
            .finally(() => setLoading(false))
    }, [id])

    async function handleApply() {
        setApplying(true)
        try {
            await axios.post(`/api/sync/${id}/apply`)
            navigate('/sync/history')
        } catch (err) {
            setError(err.response?.data?.error ?? 'Apply failed')
        } finally {
            setApplying(false)
        }
    }

    if (loading) return <div style={{ padding: 40, color: '#666' }}>Loading preview...</div>
    if (error) return <div style={{ padding: 40, color: '#c00' }}>{error}</div>
    if (!data) return null

    const { stats, grouped } = data
    const allItems = [
        ...grouped.conflicts,
        ...grouped.adds,
        ...grouped.updates,
        ...grouped.removes,
    ]

    const hasUnresolvedConflicts = grouped.conflicts.some(c => !c.resolution)

    return (
        <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Sync Preview</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>Review changes before applying to Almaa EDU</p>
                </div>
                <a href="/sync" style={{ fontSize: 13, color: '#666' }}>← Upload new</a>
            </div>

            {/* stats */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                <StatCard label="adds" count={stats.adds} type="add" />
                <StatCard label="updates" count={stats.updates} type="update" />
                <StatCard label="removes" count={stats.removes} type="remove" />
                <StatCard label="conflicts" count={stats.conflicts} type="conflict" />
            </div>

            {/* conflict warning */}
            {hasUnresolvedConflicts && (
                <div style={{
                    background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6,
                    padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400e'
                }}>
                    ⚠ {grouped.conflicts.filter(c => !c.resolution).length} unresolved conflict(s) —
                    these will be skipped on apply. Resolve them below before applying if needed.
                </div>
            )}

            {/* items table */}
            <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, overflow: 'hidden', marginBottom: 24 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e5e5' }}>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#444' }}>Type</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#444' }}>Entity</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#444' }}>Sourced ID</th>
                            <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#444' }}>Detail</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allItems.length === 0
                            ? <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: '#888' }}>No changes detected</td></tr>
                            : allItems.map(item => <ItemRow key={item.id} item={item} />)
                        }
                    </tbody>
                </table>
            </div>

            {/* conflict resolution */}
            {grouped.conflicts.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: 20, marginBottom: 24 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Resolve Conflicts</h2>
                    {grouped.conflicts.map(item => (
                        <ConflictRow key={item.id} item={item} syncRunId={id} onResolved={() => {
                            axios.get(`/api/sync/${id}/preview`).then(res => setData(res.data))
                        }} />
                    ))}
                </div>
            )}

            {/* apply button */}
            <div style={{ display: 'flex', gap: 12 }}>
                <button
                    onClick={handleApply}
                    disabled={applying}
                    style={{
                        background: '#1a1a1a', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '10px 24px', fontSize: 14,
                        cursor: applying ? 'not-allowed' : 'pointer', opacity: applying ? 0.6 : 1
                    }}
                >
                    {applying ? 'Applying...' : 'Apply Sync'}
                </button>
                <a href="/sync/history" style={{ fontSize: 13, color: '#666', lineHeight: '40px' }}>
                    View history →
                </a>
            </div>
        </div>
    )
}

function ConflictRow({ item, syncRunId, onResolved }) {
    const [resolution, setResolution] = useState(item.resolution ?? '')
    const [saving, setSaving] = useState(false)

    async function handleResolve(value) {
        setResolution(value)
        setSaving(true)
        try {
            await axios.post(`/api/sync/${syncRunId}/resolve`, {
                resolutions: [{ itemId: item.id, resolution: value }]
            })
            onResolved()
        } finally {
            setSaving(false)
        }
    }

    return (
        <div style={{
            border: '1px solid #fcd34d', borderRadius: 6, padding: 14,
            marginBottom: 12, background: '#fffbeb'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{item.sourced_id}</span>
                    <span style={{ color: '#92400e', fontSize: 12, marginLeft: 8 }}>{item.conflict_type}</span>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                        Incoming: {item.incoming_data?.email ?? item.incoming_data?.name ?? JSON.stringify(item.incoming_data).slice(0, 60)}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => handleResolve('skip')}
                        disabled={saving}
                        style={{
                            padding: '5px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                            background: resolution === 'skip' ? '#1a1a1a' : '#fff',
                            color: resolution === 'skip' ? '#fff' : '#444',
                            border: '1px solid #ddd'
                        }}
                    >
                        Skip
                    </button>
                    <button
                        onClick={() => handleResolve('override')}
                        disabled={saving}
                        style={{
                            padding: '5px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
                            background: resolution === 'override' ? '#1a1a1a' : '#fff',
                            color: resolution === 'override' ? '#fff' : '#444',
                            border: '1px solid #ddd'
                        }}
                    >
                        Override
                    </button>
                </div>
            </div>
        </div>
    )
}