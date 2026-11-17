const nodemailer = require('nodemailer');

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const b = req.body || {};
  if (b.botcheck) return res.status(200).json({ ok: true }); // spam trap

  const name = String(b.name || '').trim().slice(0, 200);
  const phone = String(b.phone || '').trim().slice(0, 50);
  const email = String(b.email || '').trim().slice(0, 200);
  const message = String(b.message || '').trim().slice(0, 3000);
  const page = String(b.page || 'Landing page').slice(0, 200);

  if (!name || !phone || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Missing or invalid fields' });
  }

  try {
    const port = Number(process.env.SMTP_PORT || 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"JOS Website" <${process.env.SMTP_USER}>`,
      to: process.env.TO_EMAIL,
      replyTo: email,
      subject: `New consultation request: ${page}`,
      text: `Page: ${page}\nName: ${name}\nPhone: ${phone}\nEmail: ${email}\nMessage: ${message || '-'}`,
      html: `<h3>New consultation request</h3>
        <p><b>Page:</b> ${esc(page)}</p>
        <p><b>Name:</b> ${esc(name)}</p>
        <p><b>Phone:</b> ${esc(phone)}</p>
        <p><b>Email:</b> ${esc(email)}</p>
        <p><b>Message:</b> ${esc(message || '-')}</p>`,
    });

    // Optional: also send the lead to a CRM / GoHighLevel / Zapier webhook
    if (process.env.WEBHOOK_URL) {
      try {
        await fetch(process.env.WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page, name, phone, email, message }),
        });
      } catch (e) {
        console.error('Webhook failed', e);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Send failed', err);
    return res.status(500).json({ ok: false });
  }
};
