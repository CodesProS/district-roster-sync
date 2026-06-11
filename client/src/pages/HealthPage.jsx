import { useEffect, useState } from 'react'
import axios from 'axios'

function Section({ title, count, children, color }) {
    return (
        <div style={{
            background: '#fff', border: '1px solid #e5e5e5',
            borderRadius: 8, marginBottom: 16, overflow: 'hidden'
        }}>
            <div style={{
                padding: '12px 20px', borderBottom: count > 0 ? '1px solid #e5e5e5' : 'none',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
                <span style={{
                    background: count > 0 ? '#fff1f2' : '#f0fdf4',
                    color: count > 0 ? '#991b1b' : '#166534',
                    border: `1px solid ${count > 0 ? '#fca5a5' : '#86efac'}`,
                    borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 500
                }}>
                    {count} issue{count !== 1 ? 's' : ''}
                </span>
            </div>
            {count > 0 && (
                <div style={{ padding: '12px 20px' }}>{children}</div>
            )}
        </div>
    )
}

export default function HealthPage() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        axios.get('/api/health')
            .then(res => setData(res.data))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div style={{ padding: 40, color: '#666' }}>Loading...</div>
    if (!data) return null

    const { summary } = data
    const totalIssues = Object.values(summary).reduce((a, b) => a + b, 0)

    return (
        <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Data Health</h1>
                    <p style={{ color: '#666', fontSize: 13 }}>
                        {totalIssues === 0
                            ? 'All data looks healthy.'
                            : `${totalIssues} issue${totalIssues !== 1 ? 's' : ''} found across the district.`
                        }
                    </p>
                </div>
                <a href="/sync/history" style={{ fontSize: 13, color: '#666' }}>← Sync history</a>
            </div>

            <Section title="Students with no active enrollment" count={summary.orphanedStudents}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <th style={{ textAlign: 'left', padding: '6px 0', color: '#888', fontWeight: 500 }}>Name</th>
                            <th style={{ textAlign: 'left', padding: '6px 0', color: '#888', fontWeight: 500 }}>Email</th>
                            <th style={{ textAlign: 'left', padding: '6px 0', color: '#888', fontWeight: 500 }}>Sourced ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.orphanedStudents.map(s => (
                            <tr key={s.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                                <td style={{ padding: '8px 0' }}>{s.first_name} {s.last_name}</td>
                                <td style={{ padding: '8px 0', color: '#666' }}>{s.email}</td>
                                <td style={{ padding: '8px 0', fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{s.sourced_id}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Section>

            <Section title="Classes with no teacher" count={summary.classesWithoutTeacher}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <th style={{ textAlign: 'left', padding: '6px 0', color: '#888', fontWeight: 500 }}>Class</th>
                            <th style={{ textAlign: 'left', padding: '6px 0', color: '#888', fontWeight: 500 }}>Sourced ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.classesWithoutTeacher.map(c => (
                            <tr key={c.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                                <td style={{ padding: '8px 0' }}>{c.title}</td>
                                <td style={{ padding: '8px 0', fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{c.sourced_id}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Section>

            <Section title="Stale enrollments (inactive user or class)" count={summary.staleEnrollments}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <th style={{ textAlign: 'left', padding: '6px 0', color: '#888', fontWeight: 500 }}>Student</th>
                            <th style={{ textAlign: 'left', padding: '6px 0', color: '#888', fontWeight: 500 }}>Class</th>
                            <th style={{ textAlign: 'left', padding: '6px 0', color: '#888', fontWeight: 500 }}>Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.staleEnrollments.map(e => (
                            <tr key={e.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                                <td style={{ padding: '8px 0' }}>{e.first_name} {e.last_name}</td>
                                <td style={{ padding: '8px 0', color: '#666' }}>{e.class_title}</td>
                                <td style={{ padding: '8px 0', color: '#888' }}>{e.role}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Section>

            <Section title="Classes with inactive term" count={summary.unmappedClasses}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <th style={{ textAlign: 'left', padding: '6px 0', color: '#888', fontWeight: 500 }}>Class</th>
                            <th style={{ textAlign: 'left', padding: '6px 0', color: '#888', fontWeight: 500 }}>Term</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.unmappedClasses.map(c => (
                            <tr key={c.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                                <td style={{ padding: '8px 0' }}>{c.title}</td>
                                <td style={{ padding: '8px 0', color: '#888' }}>{c.term_name}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Section>
        </div>
    )
}