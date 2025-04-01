import React, { useState, useEffect, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { Input } from './input';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  onKeyUp?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className,
  onKeyUp,
  ...props
}: AutocompleteInputProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const [suggestion, setSuggestion] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLInputElement>(null);

  // Mettre à jour la suggestion lorsque l'utilisateur tape
  useEffect(() => {
    if (!value) {
      setSuggestion('');
      return;
    }

    // Rechercher une suggestion qui commence par le texte actuel (insensible à la casse)
    const match = suggestions.find(item => 
      item.toLowerCase().startsWith(value.toLowerCase()) && 
      item.toLowerCase() !== value.toLowerCase()
    );

    setSuggestion(match || '');
  }, [value, suggestions]);

  // Gestionnaire pour compléter automatiquement avec Tab ou flèche droite en fin de texte
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (suggestion && (e.key === 'Tab' || 
        (e.key === 'ArrowRight' && 
         inputRef.current?.selectionStart === inputRef.current?.value.length))) {
      e.preventDefault();
      onChange(suggestion);
    }
  };

  // Gestionnaire pour le changement de valeur
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  // Gestionnaire pour gérer les autres événements clavier
  const handleKeyUp = (e: KeyboardEvent<HTMLInputElement>) => {
    if (onKeyUp) {
      onKeyUp(e);
    }
  };

  return (
    <div className="relative">
      {/* Champ d'entrée réel (transparent avec le texte de l'utilisateur) */}
      <Input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        placeholder={placeholder}
        className={`absolute inset-0 bg-transparent z-10 ${className}`}
        autoComplete="off"
        {...props}
      />
      
      {/* Champ de suggestion (grisé) */}
      <Input
        ref={suggestionRef}
        value={suggestion}
        readOnly
        className={`pointer-events-none text-muted-foreground ${className}`}
        tabIndex={-1}
      />
    </div>
  );
}
