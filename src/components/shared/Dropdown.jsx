import { useEffect, useId, useRef, useState } from 'react';
import { FORM_CONTROL_CLASS_NAME } from '../../styles/classNames';

const Dropdown = ({
  className = '',
  disabled = false,
  label,
  onChange,
  options,
  placeholder = 'Select an option',
  searchable = true,
  searchPlaceholder = 'Search options',
  value,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const generatedId = useId();
  const labelId = `${generatedId}-label`;
  const listboxId = `${generatedId}-listbox`;
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredOptions = searchable && normalizedSearchTerm
    ? options.filter((option) => (
        String(option.label ?? '').toLowerCase().includes(normalizedSearchTerm)
        || String(option.value ?? '').toLowerCase().includes(normalizedSearchTerm)
      ))
    : options;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
        triggerRef.current?.focus();
      }
    };

    // These document-level listeners let clicks outside the component and the
    // Escape key close the custom menu like a native select control.
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
      setSearchTerm('');
    }
  }, [disabled]);

  const toggleDropdown = () => {
    if (disabled) {
      return;
    }

    if (isOpen) {
      setSearchTerm('');
    }

    setIsOpen(!isOpen);
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`} ref={dropdownRef}>
      {label && (
        <span className="text-sm font-medium text-on-primary" id={labelId}>
          {label}
        </span>
      )}
      <div className="relative">
        <button
          aria-label={`${label ? `${label}: ` : ''}${selectedOption?.label ?? placeholder}`}
          aria-controls={isOpen ? listboxId : undefined}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className={`${FORM_CONTROL_CLASS_NAME} flex items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60`}
          disabled={disabled}
          onClick={toggleDropdown}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setIsOpen(true);
            }
          }}
          ref={triggerRef}
          type="button"
        >
          <span className={`truncate ${selectedOption ? '' : 'text-on-secondary/90'}`}>
            {selectedOption?.label ?? placeholder}
          </span>
          <svg
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="m6 9 6 6 6-6"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>

        {isOpen && (
          <div
            className="absolute left-0 right-0 top-full z-40 mt-2 flex max-h-64 flex-col rounded-2xl border border-on-primary/15 bg-primary p-2 shadow-2xl shadow-primary/30"
          >
            {searchable && options.length > 0 && (
              <input
                aria-label={searchPlaceholder}
                autoFocus
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-on-secondary outline-none transition placeholder:text-on-secondary/70 focus:border-primary focus:ring-4 focus:ring-primary/15"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={searchPlaceholder}
                type="search"
                value={searchTerm}
              />
            )}

            <div
              aria-labelledby={label ? labelId : undefined}
              className={`${searchable && options.length > 0 ? 'mt-2' : ''} min-h-0 overflow-y-auto`}
              id={listboxId}
              role="listbox"
            >
              {options.length === 0 ? (
                <p className="rounded-xl px-4 py-3 text-sm text-on-primary/70">
                  No options available
                </p>
              ) : filteredOptions.length === 0 ? (
                <p className="rounded-xl px-4 py-3 text-sm text-on-primary/70">
                  No matching options
                </p>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = option.value === value;

                  return (
                    <button
                      aria-selected={isSelected}
                      className={`flex w-full rounded-xl px-4 py-3 text-left text-sm font-semibold outline-none transition ${
                        isSelected
                          ? 'bg-secondary text-on-secondary'
                          : 'text-on-primary hover:bg-accent hover:text-on-primary focus:bg-accent focus:text-on-primary'
                      }`}
                      key={option.value}
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      role="option"
                      type="button"
                    >
                      {option.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dropdown;
