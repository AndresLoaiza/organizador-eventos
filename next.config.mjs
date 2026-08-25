/** @type {import('next').NextConfig} */

// Salida estática para GitHub Pages: no hay servidor, así que no hay route
// handlers ni middleware. Todo el acceso a datos ocurre en el navegador contra
// PostgREST, con el código de acceso viajando en una cabecera que RLS verifica.
const repo = 'organizador-eventos';
const enPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: enPages ? `/${repo}` : '',
  assetPrefix: enPages ? `/${repo}/` : '',
};

export default nextConfig;
