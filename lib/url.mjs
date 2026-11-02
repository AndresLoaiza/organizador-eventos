// Solo http(s): un enlace guardado en la base no debe poder ser javascript: ni data:.
export const urlSegura = (u) => {
  try { return ['http:', 'https:'].includes(new URL(u).protocol) ? u : null; } catch { return null; }
};
