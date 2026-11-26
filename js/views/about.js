import { h } from '../../vendor/preact.module.js';
import htm from '../../vendor/htm.module.js';
import { REPO_URL, LETSIMPL_URL } from '../config.js';

const html = htm.bind(h);

const SECTIONS = [
  ['What is Quarchive?', html`<p>Quarchive is an open-source platform for students to discover, download, and contribute previous year university exam question papers. Every paper is permanently stored on the Internet Archive — free to access, forever.</p>`],
  ['How to Find Papers', html`<p>Use the search bar on the home page to find papers by university name, course code, or year. You can also browse papers by university, year, or exam type. Click on any paper to view it directly or download the PDF.</p>`],
  ['How to Contribute', html`<p>Anyone with an Internet Archive account can upload question papers. Sign in with your Archive.org credentials, fill in the paper details (university, course, year), and upload the PDF. Your contribution is permanently archived and freely accessible to all students.</p>`],
  ['Why Archive.org?', html`<p>We use the Internet Archive as our storage backend because it's free, permanent, and open. Papers uploaded to Archive.org are preserved indefinitely and are accessible to anyone, anywhere. No proprietary lock-in, no subscription fees, no data loss.</p>`],
  ['Open Source', html`<p>Quarchive is fully open-source. The code is available on <a class="ls-out" href=${REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>. We welcome contributions — whether it's uploading papers, improving the code, or suggesting features. Design comes from <a class="ls-out" href=${LETSIMPL_URL} target="_blank" rel="noopener noreferrer">letsimpl.fyi</a>.</p>`],
  ['Attribution', html`<p>Built with:</p>
    <ul>
      <li>Internet Archive — permanent file storage and search</li>
      <li>Wikidata — canonical institution identifiers</li>
      <li>Cloudflare Pages — hosting and edge functions</li>
      <li>Preact, htm and the letsimpl.fyi brand — static frontend stack</li>
      <li><a class="ls-out" href="https://github.com/scribeocr/scribe.js" target="_blank" rel="noopener noreferrer">scribe.js-ocr</a> (<a class="ls-out" href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer">AGPL-3.0</a>) — on-device OCR for auto-suggesting paper metadata. Runs entirely in your browser; no page image or recognised text ever leaves your device.</li>
      <li><a class="ls-out" href="https://pdf-lib.js.org/" target="_blank" rel="noopener noreferrer">pdf-lib</a>, <a class="ls-out" href="https://github.com/Donaldcwl/browser-image-compression" target="_blank" rel="noopener noreferrer">browser-image-compression</a> and <a class="ls-out" href="https://mozilla.github.io/pdf.js/" target="_blank" rel="noopener noreferrer">pdf.js</a> — client-side camera-scan to PDF assembly and preview</li>
    </ul>`],
  ['Privacy', html`<p>Camera scans are processed entirely on your device. Edge detection, perspective correction, image enhancement, and OCR all run in your browser — no image or extracted text is ever sent to Quarchive or any third party. The only thing transmitted is the final PDF, and only at the moment you confirm the upload to the Internet Archive.</p>`],
];

export function About() {
  return html`<article class="ls-prose">
    <h1>About Quarchive</h1>
    ${SECTIONS.map(([title, body]) => html`<section key=${title}>
      <h2>${title}</h2>
      ${body}
    </section>`)}
  </article>`;
}

export default About;
