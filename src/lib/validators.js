export const nullableString = (value) => {
  const trimmedValue = String(value ?? '').trim();

  return trimmedValue || null;
};

export const isNumericString = (value) => /^-?\d+(\.\d+)?$/.test(value);

export const getMinimumLengthMessage = (label, minimumLength) => (
  `${label} must be at least ${minimumLength} characters.`
);
