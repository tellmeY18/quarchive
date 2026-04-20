export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <h1 className="font-heading text-2xl md:text-3xl font-bold">
        About Quarchive
      </h1>

      <section className="mt-6 md:mt-8">
        <h2 className="font-heading text-lg md:text-xl font-semibold mb-3">
          What is Quarchive?
        </h2>
        <p className="text-pyqp-text-light leading-relaxed">
          Quarchive is an open-source platform for students to discover,
          download, and contribute previous year university exam question
          papers. Every paper is permanently stored on the Internet Archive
          &mdash; free to access, forever.
        </p>
      </section>

      <section className="mt-6 md:mt-8">
        <h2 className="font-heading text-lg md:text-xl font-semibold mb-3">
          How to Find Papers
        </h2>
        <p className="text-pyqp-text-light leading-relaxed">
          Use the search bar on the home page to find papers by university name,
          course code, or year. You can also browse papers by university, year,
          or exam type. Click on any paper to view it directly or download the
          PDF.
        </p>
      </section>

      <section className="mt-6 md:mt-8">
        <h2 className="font-heading text-lg md:text-xl font-semibold mb-3">
          How to Contribute
        </h2>
        <p className="text-pyqp-text-light leading-relaxed">
          Anyone with an Internet Archive account can upload question papers.
          Sign in with your Archive.org credentials, fill in the paper details
          (university, course, year), and upload the PDF. Your contribution is
          permanently archived and freely accessible to all students.
        </p>
      </section>

      <section className="mt-6 md:mt-8">
        <h2 className="font-heading text-lg md:text-xl font-semibold mb-3">
          Why Archive.org?
        </h2>
        <p className="text-pyqp-text-light leading-relaxed">
          We use the Internet Archive as our storage backend because it&#39;s
          free, permanent, and open. Papers uploaded to Archive.org are
          preserved indefinitely and are accessible to anyone, anywhere. No
          proprietary lock-in, no subscription fees, no data loss.
        </p>
      </section>

      <section className="mt-6 md:mt-8">
        <h2 className="font-heading text-lg md:text-xl font-semibold mb-3">
          Open Source
        </h2>
        <p className="text-pyqp-text-light leading-relaxed">
          Quarchive is fully open-source. The code is available on{" "}
          <a
            href="#"
            className="text-pyqp-accent hover:text-pyqp-accent-hover underline"
          >
            GitHub
          </a>
          . We welcome contributions &mdash; whether it&#39;s uploading papers,
          improving the code, or suggesting features.
        </p>
      </section>

      <section className="mt-6 md:mt-8">
        <h2 className="font-heading text-lg md:text-xl font-semibold mb-3">
          Attribution
        </h2>
        <p className="text-pyqp-text-light leading-relaxed mb-3">Built with:</p>
        <ul className="list-disc list-inside space-y-2 text-pyqp-text-light leading-relaxed">
          <li>Internet Archive &mdash; permanent file storage and search</li>
          <li>Wikidata &mdash; canonical institution identifiers</li>
          <li>Cloudflare Pages &mdash; hosting and edge functions</li>
          <li>React, Tailwind CSS, Zustand &mdash; frontend stack</li>
          <li>
            <a
              href="https://github.com/scribeocr/scribe.js"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pyqp-accent hover:text-pyqp-accent-hover underline"
            >
              scribe.js-ocr
            </a>{" "}
            (
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pyqp-accent hover:text-pyqp-accent-hover underline"
            >
              AGPL-3.0
            </a>
            ) &mdash; on-device OCR for auto-suggesting paper metadata. Runs
            entirely in your browser; no page image or recognised text ever
            leaves your device.
          </li>
          <li>
            <a
              href="https://pdf-lib.js.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pyqp-accent hover:text-pyqp-accent-hover underline"
            >
              pdf-lib
            </a>
            ,{" "}
            <a
              href="https://github.com/Donaldcwl/browser-image-compression"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pyqp-accent hover:text-pyqp-accent-hover underline"
            >
              browser-image-compression
            </a>{" "}
            &mdash; client-side camera-scan to PDF assembly
          </li>
        </ul>
      </section>

      <section className="mt-6 md:mt-8">
        <h2 className="font-heading text-lg md:text-xl font-semibold mb-3">
          Privacy
        </h2>
        <p className="text-pyqp-text-light leading-relaxed">
          Camera scans are processed entirely on your device. Edge detection,
          perspective correction, image enhancement, and OCR all run in your
          browser &mdash; no image or extracted text is ever sent to Quarchive
          or any third party. The only thing transmitted is the final PDF, and
          only at the moment you confirm the upload to the Internet Archive.
        </p>
      </section>
    </div>
  );
}
