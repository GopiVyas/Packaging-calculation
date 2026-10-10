import { useState } from 'react'

const initialForm = { companyName: '', email: '', phone: '' }

function Register() {
  const [form, setForm] = useState(initialForm)
  const [status, setStatus] = useState({ type: '', message: '' })
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value })

  async function submit(event) {
    event.preventDefault()
    setStatus({ type: '', message: '' })
    try {
      const response = await fetch('http://localhost:3001/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Registration failed.')
      setStatus({ type: 'success', message: 'Your company has been registered.' })
      setForm(initialForm)
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    }
  }

  return <section className="register-page">
    <div className="register-copy"><p className="eyebrow">WELCOME TO PACKWISE</p><h1>Start packing smarter.</h1><p>Register your company to save packaging standards and plan every shipment in one place.</p></div>
    <form className="register-card" onSubmit={submit}><div className="panel-heading"><div><span className="step-number">01</span><h2>Company registration</h2></div></div><div className="form-stack"><label>Company name<input required value={form.companyName} onChange={update('companyName')} placeholder="Acme Manufacturing" /></label><label>Email address<input required type="email" value={form.email} onChange={update('email')} placeholder="you@company.com" /></label><label>Phone number<input required type="tel" value={form.phone} onChange={update('phone')} placeholder="+1 555 123 4567" /></label></div>{status.message && <p className={`form-status ${status.type}`}>{status.message}</p>}<button className="primary-button" type="submit">Create company account <span>→</span></button><p className="form-note">Your details are stored securely in your MongoDB database.</p></form>
  </section>
}

export default Register
