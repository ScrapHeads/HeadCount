// Teams can edit this function to change how automatic student IDs are built.
// The default format is the current four-digit year followed by 10-99.
export const generateUniqueStudentId = async ({
  isAvailable,
  now = new Date(),
  random = Math.random,
}) => {
  if (typeof isAvailable !== 'function') {
    throw new Error('Student ID availability checker is required.');
  }

  const year = now.getFullYear();
  const suffixes = Array.from({ length: 90 }, (_, index) => index + 10);

  for (let index = suffixes.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [suffixes[index], suffixes[randomIndex]] = [suffixes[randomIndex], suffixes[index]];
  }

  for (const suffix of suffixes) {
    const candidateId = `${year}${suffix}`;

    if (await isAvailable(candidateId)) {
      return candidateId;
    }
  }

  throw new Error(`No generated student IDs are available for ${year}.`);
};
