// Netlify: exit 0 cancels a build; exit 1 proceeds to the guarded build command.
// Development branches and pull requests never build against the original project.
const production = process.env.NETLIFY === 'true' && process.env.CONTEXT === 'production' &&
  process.env.BRANCH === 'main' && process.env.PULL_REQUEST === 'false' &&
  process.env.NETLIFY_PREVIEW_SERVER !== 'true';
console.log(production ? 'Production main: checking the pinned build contract next.' : 'Build skipped: only production main is enabled.');
process.exit(production ? 1 : 0);
