# FoldSheet

Local PDF booklet imposition for community print runs. Newly built for WarriorHacks 2.0. Source publication, event registration, and final submission are separate stages; this repository does not establish hackathon acceptance.

Run a static server from this directory:

```sh
python3 -m http.server 50220 --bind 127.0.0.1
```

Open http://127.0.0.1:50220 and choose Open sample. Inspect all three sheets, switch Front/Back, choose paper and margins, then export. Back rotation changes the actual output page rotation. Print a calibration sheet before using a real printer. Imported documents are not uploaded or persisted.

The adapter rejects malformed, encrypted, annotated and interactive PDFs; 1–64 pages and 20 MiB input are supported. Content is scaled into two page cells without cropping. This tool does not certify printer compatibility, privacy sanitization, accessibility of exported PDFs, or measured waste savings. Thick booklets may need smaller signatures and professional finishing.

The source is separated into imposition planning, PDF transformation, and browser controller. Local vendor files come from the already-installed Codex runtime: pdf-lib 1.17.1 (MIT), PDF.js 5.6.205 (Apache-2.0). Licenses and original distribution hashes are in vendor/. No external runtime calls or model inference are required. The generated sample is fictional and contains no personal data. Codex authored the original specification, implementation, sample, copy, and tests under the user's direction; no unaided human authorship, user interviews or human understanding certification is claimed.

Run the core tests with Node:

```sh
node --test test/*.test.mjs
```

Tests use the included vendor distribution, without an absolute dependency path or package installation. Thirteen tests passed locally, including page coverage for all 64 supported counts and an encrypted fixture rejection. The six-side synthetic output was reopened and visually reviewed. A four-page fixture with cropped bounds and 0/90/180/270-degree rotations was transformed, rendered and visually compared on every source page and both output sides. The browser imported that fixture and rejected the encrypted fixture with export disabled. Sample, front/back, 180° back rotation, actual download, and desktop/mobile layouts were also checked. These controlled fixtures do not establish compatibility with every PDF. A separate central task independently reviewed the three source modules and two test files and ran all 13 tests successfully. A distinct media reviewer decoded and inspected 12 samples from the exact local demo video; no mandatory fixes were found within those bounded scopes. These reviews do not certify live browser behavior, arbitrary PDF compatibility, physical printing, participant eligibility, public delivery, or final acceptance. No physical printing was tested.

QA PDFs and renders next to this source are development evidence; they should not be included automatically in a public source bundle. The public source repository is https://github.com/estona815/foldsheet-warriorhacks-2026. Local test and review results do not establish event registration or final submission.
