import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const CSV_FIELDS = ['orgs', 'terms', 'users', 'classes', 'enrollments']

export default function UploadPage() {
    const [files, setFiles] = useState({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const navigate = useNavigate()

    function handleFileChange(field, file) {
        setFiles(prev => ({ ...prev, [field]: file }))
    }

    async function handleUpload() {
        // make sure at least one file is selected
        if (Object.keys(files).length === 0) {
            setError('Please select at least one CSV file')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const formData = new FormData()
            for (const [field, file] of Object.entries(files)) {
                formData.append(field, file)
            }

            const res = await axios.post('/api/sync/upload', formData)
            // navigate to preview page with the sync run id
            navigate(`/sync/${res.data.syncRunId}`)
        } catch (err) {
            setError(err.response?.data?.error ?? 'Upload failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ maxWidth: 600, margin: '60px auto', padding: '0 20px' }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Roster Sync</h1>
            <p style={{ color: '#666', marginBottom: 32 }}>
                Upload OneRoster CSV files to preview and apply changes to Almaa EDU.
            </p>

            <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 8, padding: 24, marginBottom: 16 }}>
                {CSV_FIELDS.map(field => (
                    <div key={field} style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontWeight: 500, marginBottom: 6, textTransform: 'capitalize' }}>
                            {field}.csv
                        </label>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={e => handleFileChange(field, e.target.files[0])}
                            style={{ fontSize: 13, color: '#444' }}
                        />
                        {files[field] && (
                            <span style={{ marginLeft: 10, fontSize: 12, color: '#888' }}>
                                {files[field].name}
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {error && (
                <div style={{ background: '#fff0f0', border: '1px solid #fcc', borderRadius: 6, padding: 12, marginBottom: 16, color: '#c00', fontSize: 13 }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                    onClick={handleUpload}
                    disabled={loading}
                    style={{
                        background: '#1a1a1a', color: '#fff', border: 'none',
                        borderRadius: 6, padding: '10px 20px', fontSize: 14,
                        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1
                    }}
                >
                    {loading ? 'Uploading...' : 'Upload and Preview'}
                </button>

                <a href="/sync/history" style={{ fontSize: 13, color: '#666' }}>
                    View sync history →
                </a>
            </div>
        </div>
    )
}