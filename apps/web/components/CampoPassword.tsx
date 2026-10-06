'use client';

import { useId, useState } from 'react';

interface Props {
  name: string;
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  required?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  ayuda?: string;
  error?: string;
}

/**
 * Campo de contraseña con ojito para ver lo escrito.
 *
 * En el mostrador se tipea rápido y a veces desde el celular, donde
 * es fácil equivocarse sin darse cuenta. Poder leer lo que se escribió
 * evita el ida y vuelta de "no me toma la clave".
 */
export function CampoPassword({
  name,
  label = 'Contraseña',
  placeholder,
  value,
  onChange,
  required,
  autoFocus,
  autoComplete = 'current-password',
  ayuda,
  error,
}: Props) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <label className="block" htmlFor={id}>
      <span className="block text-xs text-verde-claro mb-1">{label}</span>

      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          required={required}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          className="input pr-20"
        />

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1
                     text-xs text-verde-claro hover:text-verde-esmalte"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {visible ? 'Ocultar' : 'Ver'}
        </button>
      </div>

      {ayuda && !error && (
        <span className="block text-xs text-verde-claro/70 mt-1">{ayuda}</span>
      )}
      {error && (
        <span className="block text-xs text-rojo-plomo mt-1">{error}</span>
      )}
    </label>
  );
}