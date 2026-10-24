# Padlock Lab

A local research tool for bounded computational design of single-zone padlock probes, matching RCA primers, and complete LbaCas12a crRNAs. It preserves the original study design as a reference and distinguishes it from unvalidated computational recommendations.

**Version:** 0.2.0-rc.1 (release candidate). [Source repository](https://github.com/zhenq-zq/padlock-lab) · [Frozen release](https://github.com/zhenq-zq/padlock-lab/releases/tag/v0.2.0-rc.1). No archival DOI has been assigned. See [release status](docs/publication/RELEASE_STATUS.md). Original source code uses MIT; dependencies retain their own licenses.

## Quick start

Requirements: Python3.11 or later and a modern browser. Run from this project's root. The fixed versions below were tested on macOS/Python3.11; other systems are checked by the supplied CI workflow when it runs.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m analysis.serve_dashboard --port 8768
```

Open http://127.0.0.1:8768/design-en.html (English) or http://127.0.0.1:8768/design.html (Chinese). The English study example retains the visual alignment and circular candidate previews. Use **Use my target** or the target selector to choose a target. The English reader jointly designs all three oligos and initially selects a computational recommendation. Only the exact study PIK3CA H1047R target includes the original experimental design as the last reference option. Readout temperature and salt are under **Conditions**; the matched sequence panel copies or downloads the selected set. Use the language link to switch. On Windows, use `.venv\Scripts\python` in place of `.venv/bin/python`.

The Python service is required for new calculations; opening the HTML file or using a static server alone is not enough. It binds only to127.0.0.1 and is intended for local use. GitHub Pages cannot run this Python API. An independently hosted public computation service is optional and is not provided by this release candidate.

## Design and export

Choose the study WT78/Mut79 target, another reference variant, or enter one WT DNA sequence and select a single alternate base. The study50nt fragment is the single H1047R catalog entry. The separate61nt genomic source is retained for provenance. Positions in the interface are1-based within the supplied fragment, not genomic coordinates.

- The English reader always jointly computes matched sets. The legacy Chinese interface and API retain fixed-module screening for compatibility.
- **Joint design:** generate new primer/spacer pools, then screen matched padlock/primer/full crRNA sets. Matching oligos must be used together.
- Automatic candidates require zero contiguous Spacer1/3 extension at the intended boundaries on both supplied WT and Mut. The experimental reference is exempt and honestly displays its original extension.
- Full-oligo exact-complement screening rejects unintended8nt matches and flags6–7nt matches for review. These are engineering thresholds, not calibrated interference probabilities.
- Viewing a candidate does not change the next calculation's input. Deliberate edits in **Modules** change the inputs for regeneration.
- JSON schema2 records the full request, selected candidate, application/source hashes, models, conditions and seed. `candidates` contains only computed designs; `reference` is separate. English reader sequence displays and FASTA exports prefix padlock DNA with the IDT ordering token `/5Phos/`; the primer and complete crRNA are exported as the matching set. JSON preserves raw ACGT sequences for computation and replay.

Local drafts include sequences, module inputs, design mode and readout conditions. Results are not restored from browser storage: export JSON to preserve them. A file is parsed in the browser; the sequence is sent to the local Python API when you calculate. This is not a promise about a future externally hosted service.

## CLI and replay

```sh
.venv/bin/python -m analysis.design_cli examples/lab-target.request.json -o result.json
.venv/bin/python -m analysis.replay result.json -o replay.json
```

The second command checks request and source checksums and compares candidate sequences. Use a frozen release and its pinned dependencies. A deliberate version comparison requires `--allow-version-mismatch`; it is not silently accepted.

## Tests

```sh
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
```

HTTP tests skip when no service is specified. With the service running:

```sh
PADLOCK_TEST_URL=http://127.0.0.1:8768 .venv/bin/python -m pytest -q
```

Optional browser verification requires Node20+:

```sh
npm ci
npx playwright install chromium
npm test
PADLOCK_TEST_URL=http://127.0.0.1:8768 npm run test:browser
```

`CHROME_PATH` can explicitly select an existing Chrome/Chromium executable. No author's machine path is built into these tests. On Windows, set the environment variable using PowerShell's `$env:PADLOCK_TEST_URL` syntax.

## Methods and limits

See [METHODS](docs/METHODS.md), [SCHEMA](docs/SCHEMA.md), [third-party notices](THIRD_PARTY_NOTICES.md), and the [change log](CHANGELOG.md). Perfect-match arm Tm uses Biopython DNA_NN4/Owczarzy2008 with the supplied ions. DNA/RNA structure models are separate and omit Mg/RNP kinetics. The DNA fold engine flag is `noGU=False`; use the documented model settings rather than treating a drawing as a measured structure. Readout temperature/salt and ligation conditions are distinct. Primer Tm uses a fixed500nM reference.

The software does not predict ligase efficiency, actual RCA/Cas activity, LOD, zero background or genome-wide specificity. Structure drawings are predictions. New designs require experimental validation; adding a software link does not turn computed designs into validated samples.

## Maintainer and citation

Maintainer: [zhenq-zq](https://github.com/zhenq-zq). Software author attribution currently uses this verified public account; a full personal name can be added after author review. Use `CITATION.cff` for this release candidate. A public repository URL and DOI are added only after they actually exist.

Dependency and method citations are listed in METHODS. AI-assisted development and verification are documented in [AI_ASSISTANCE](docs/AI_ASSISTANCE.md). Software authorship is separate from the manuscript's author list.

## Source maintenance

```sh
.venv/bin/python -m analysis.catalog --write
.venv/bin/python -m analysis.build_english
```

The catalog has separate lab/reference source records. The English assets are generated from the maintained Chinese interface and explicit translation table; generated assets are included so readers do not need to rebuild them. Runtime scientific calculations are deterministic sequence/thermodynamic heuristics, not calls to an AI service.

The English interface displays and exports padlock ordering sequences with the IDT `/5Phos/` prefix. Computational JSON keeps the raw ACGT sequence for replay. Standard unmodified3′-OH is retained. The single bottom Details section contains model conditions and review notes.
