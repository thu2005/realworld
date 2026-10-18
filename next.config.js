module.exports = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    dirs: ['.'], // Only run ESLint on the 'pages' and 'utils' directories during production builds (next build)
  },
}
