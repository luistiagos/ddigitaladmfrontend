/**
 * ContactCell — reusable table-cell components for email and phone.
 *
 * EmailCell: renders a <td> with a mailto link + copy button.
 * PhoneCell: renders a <td> with a WhatsApp (wa.me) link + copy button.
 *
 * Both render the <td> themselves so callers drop them directly in a <tr>.
 */

import { useState } from 'react';
import { Mail, MessageCircle, Copy, Check } from 'lucide-react';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function handleCopy(e) {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={handleCopy}
      title="Copiar"
      className="ml-1.5 p-0.5 rounded text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
    >
      {copied
        ? <Check className="h-3.5 w-3.5 text-green-400" />
        : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function EmailCell({ email }) {
  if (!email) {
    return (
      <td className="px-4 py-3">
        <span className="text-gray-600 italic">sem e-mail</span>
      </td>
    );
  }
  return (
    <td className="px-4 py-3">
      <div className="flex items-center gap-0.5">
        <a
          href={`mailto:${email}`}
          className="text-violet-400 hover:text-violet-300 hover:underline underline-offset-2 transition-colors"
          title="Enviar e-mail"
        >
          <Mail className="h-3.5 w-3.5 inline mr-1 opacity-70" />
          {email}
        </a>
        <CopyButton text={email} />
      </div>
    </td>
  );
}

export function PhoneCell({ phone }) {
  if (!phone) {
    return <td className="px-4 py-3 text-gray-600">—</td>;
  }
  const digits = phone.replace(/\D/g, '');
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return (
    <td className="px-4 py-3">
      <div className="flex items-center gap-0.5">
        <a
          href={`https://wa.me/${number}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-400 hover:text-green-300 hover:underline underline-offset-2 transition-colors font-mono text-xs"
          title="Abrir no WhatsApp"
        >
          <MessageCircle className="h-3.5 w-3.5 inline mr-1 opacity-70" />
          {phone}
        </a>
        <CopyButton text={phone} />
      </div>
    </td>
  );
}
