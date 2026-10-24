import HelpArticleFeedback from '../components/HelpArticleFeedback'

export default function HelpArticle() {
  return (
    <div className="help-article-page">
      <article className="help-article">
        <header className="help-article-header">
          <h1>Getting Started with Veritasor</h1>
          <p className="help-article-meta">Last updated: July 2026</p>
        </header>

        <div className="help-article-body">
          <p>
            Welcome to Veritasor. This guide covers the basics of setting up your
            workspace and creating your first attestation.
          </p>
          <h2>1. Create a workspace</h2>
          <p>
            Sign up, then complete the onboarding wizard with your business
            details. Your workspace is created when you finish.
          </p>
          <h2>2. Add an attestation</h2>
          <p>
            Once your workspace is ready, connect a revenue source, then open the
            Attestations page to review runs and confirm the period summary.
          </p>
          <h2>3. Verify and share</h2>
          <p>
            After submission, attestation status updates appear in real time. You
            can share verifications with your team via the API or the built-in
            sharing controls.
          </p>
        </div>

        <HelpArticleFeedback articleId="getting-started" />
      </article>
    </div>
  )
}
