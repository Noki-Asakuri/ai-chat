// Edits made while a save is in flight would be lost when navigation unmounts the form,
// so keep saving until the values on screen match the last saved ones. Rejects if a save fails.
export async function flushAutosave<T>(options: {
  getValues: () => T;
  save: (values: T) => Promise<T>;
}): Promise<void> {
  const values = options.getValues();
  await options.save(values);
  if (JSON.stringify(options.getValues()) !== JSON.stringify(values)) await flushAutosave(options);
}
