import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'

export default function About() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <h1 className="font-heading text-3xl font-bold">About Quarchive</h1>

          <section className="mt-8">
            <h2 className="font-heading text-xl font-semibold mb-3">What is Quarchive?</h2>
            <p className="text-pyqp-text-light leading-relaxed">
              Quarchive is an open-source platform for students to
              discover, download, and contribute previous year university exam question papers.
              Every paper is permanently stored on the Internet Archive &mdash; free to access, forever.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="font-heading text-xl font-semibold mb-3">How to Find Papers</h2>
            <p className="text-pyqp-text-light leading-relaxed">
              Use the search bar on the home page to find papers by university name, course code,
              or year. You can also browse papers by university, year, or exam type. Click on any
              paper to view it directly or download the PDF.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="font-heading text-xl font-semibold mb-3">How to Contribute</h2>
            <p className="text-pyqp-text-light leading-relaxed">
              Anyone with an Internet Archive account can upload question papers. Sign in with
              your Archive.org credentials, fill in the paper details (university, course, year),
              and upload the PDF. Your contribution is permanently archived and freely accessible
              to all students.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="font-heading text-xl font-semibold mb-3">Why Archive.org?</h2>
            <p className="text-pyqp-text-light leading-relaxed">
              We use the Internet Archive as our storage backend because it&#39;s free, permanent,
              and open. Papers uploaded to Archive.org are preserved indefinitely and are accessible
              to anyone, anywhere. No proprietary lock-in, no subscription fees, no data loss.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="font-heading text-xl font-semibold mb-3">Open Source</h2>
            <p className="text-pyqp-text-light leading-relaxed">
              Quarchive is fully open-source. The code is available on{' '}
              <a
                href="#"
                className="text-pyqp-accent hover:text-pyqp-accent-hover underline"
              >
                GitHub
              </a>
              . We welcome contributions &mdash; whether it&#39;s uploading papers, improving
              the code, or suggesting features.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="font-heading text-xl font-semibold mb-3">Attribution</h2>
            <p className="text-pyqp-text-light leading-relaxed mb-3">Built with:</p>
            <ul className="list-disc list-inside space-y-2 text-pyqp-text-light leading-relaxed">
              <li>Internet Archive &mdash; permanent file storage and search</li>
              <li>Wikidata &mdash; canonical institution identifiers</li>
              <li>Cloudflare Pages &mdash; hosting and edge functions</li>
              <li>React, Tailwind CSS, Zustand &mdash; frontend stack</li>
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
