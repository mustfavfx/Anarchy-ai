import React, { useState } from 'react';
import { X, Send, HelpCircle, Mail, User, MessageSquare, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import './SupportModal.css';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  if (!isOpen) return null;

  const isValid = name.trim() && email.trim() && subject.trim() && message.trim();

  const handleSend = async () => {
    if (!isValid || sending) return;
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-support-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSent(true);
    } catch {
      setError('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setName(''); setEmail(''); setSubject(''); setMessage('');
    setSending(false); setSent(false); setError(null);
    onClose();
  };

  return (
    <div className="support-modal-overlay" onClick={handleClose}>
      <div className="support-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="support-modal-header">
          <div className="support-modal-title">
            <div className="support-icon-wrap"><HelpCircle size={20} /></div>
            <div>
              <h2>Need Help?</h2>
              <p>We'll get back to you as soon as possible</p>
            </div>
          </div>
          <button className="support-modal-close" onClick={handleClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="support-modal-body">
          {sent ? (
            <div className="support-sent-state">
              <div className="support-sent-icon"><CheckCircle size={52} /></div>
              <h3>Message Sent!</h3>
              <p>Your message has been delivered to our support team. We'll reply to your email soon.</p>
              <button className="support-send-btn" onClick={handleClose}>Done</button>
            </div>
          ) : (
            <>
              <div className="support-fields">
                <div className="support-row">
                  <div className="support-field">
                    <label><User size={13} /> Name <span className="required">*</span></label>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      disabled={sending}
                    />
                  </div>
                  <div className="support-field">
                    <label><Mail size={13} /> Email <span className="required">*</span></label>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      disabled={sending}
                    />
                  </div>
                </div>

                <div className="support-field">
                  <label><MessageSquare size={13} /> Subject <span className="required">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Bug report, Feature request..."
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    disabled={sending}
                  />
                </div>

                <div className="support-field">
                  <label><MessageSquare size={13} /> Message <span className="required">*</span></label>
                  <textarea
                    placeholder="Describe your issue or question in detail..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={5}
                    disabled={sending}
                  />
                </div>
              </div>

              {error && (
                <div className="support-error">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <div className="support-footer">
                <div className="support-footer-actions">
                  <button className="support-cancel-btn" onClick={handleClose} disabled={sending}>Cancel</button>
                  <button
                    className="support-send-btn"
                    onClick={handleSend}
                    disabled={!isValid || sending}
                  >
                    {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                    {sending ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
